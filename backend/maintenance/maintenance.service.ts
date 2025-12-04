import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from "@nestjs/common";
import { BillingService } from "../billing/billing.service";
import { JobQueueService } from "../jobs/job-queue.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class MaintenanceService implements OnModuleInit {
  private readonly logger = new Logger(MaintenanceService.name);
  private intervalHandle: NodeJS.Timeout | null = null;

  constructor(
    private readonly billingService: BillingService,
    private readonly jobQueue: JobQueueService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => require('../observability/observability.service').ObservabilityService))
    private readonly observability: any
  ) {}

  async onModuleInit() {
    // Run once at startup (non-blocking)
    this.safeRunMaintenance("startup");

    // Run every 15 minutes
    this.intervalHandle = setInterval(
      () => this.safeRunMaintenance("interval"),
      15 * 60 * 1000
    );
  }

  private async safeRunMaintenance(source: "startup" | "interval" | "manual") {
    try {
      await this.runMaintenance(source);
    } catch (err: any) {
      this.logger.error(`Maintenance run (${source}) failed`, err.stack || err);
    }
  }

  async runMaintenance(source: "startup" | "interval" | "manual" = "manual") {
    this.logger.log(`Running maintenance from: ${source}`);

    // 1) Close expired billing cycles and enqueue invoice jobs
    await this.handleBillingCycles();

    // 2) Retry dead jobs (optional)
    await this.retryDeadJobs();

    // 3) Clean up old records (optional basic cleanup)
    await this.cleanupOldAnalytics();

    // 4) Aggregate observability events into metrics
    await this.aggregateObservability();
  }

  private async handleBillingCycles() {
    try {
      // Close cycles globally for all workspaces
      const closedCycles = await this.billingService.closeCycles();

      if (!closedCycles || closedCycles.length === 0) {
        return;
      }

      for (const cycle of closedCycles) {
        await this.jobQueue.enqueue(
          "billing.closeCycle.generateInvoice",
          {
            workspaceId: cycle.workspaceId,
            cycleId: cycle.id,
            userId: "system",
            role: "owner",
          },
          cycle.workspaceId,
          { delayMs: 0 }
        );
      }

      this.logger.log(
        `Enqueued invoice jobs for ${closedCycles.length} closed cycles`
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to handle billing cycles: ${err.message}`,
        err.stack
      );
      // Don't throw - allow maintenance to continue with other tasks
    }
  }

  private async retryDeadJobs() {
    try {
      // Retry DEAD jobs updated > 10 minutes ago, limit to 100 per run
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

      const deadJobs = await this.prisma.job.findMany({
        where: {
          status: "dead",
          updatedAt: {
            lt: tenMinutesAgo,
          },
        },
        orderBy: {
          updatedAt: "asc",
        },
        take: 100,
      });

      if (deadJobs.length === 0) {
        return;
      }

      let retryCount = 0;

      for (const job of deadJobs) {
        // Only retry jobs that failed less than 7 days ago (prevent eternal retries)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (job.createdAt < sevenDaysAgo) {
          continue;
        }

        // Reset job to pending with fresh attempts
        await this.prisma.job.update({
          where: { id: job.id },
          data: {
            status: "pending",
            attempts: 0,
            scheduledAt: new Date(),
            lastError: null,
            updatedAt: new Date(),
          },
        });

        retryCount++;
      }

      if (retryCount > 0) {
        this.logger.log(`Retried ${retryCount} dead jobs`);
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to retry dead jobs: ${err.message}`,
        err.stack
      );
      // Don't throw - allow maintenance to continue
    }
  }

  private async cleanupOldAnalytics() {
    try {
      // Delete AnalyticsEvent older than 90 days, limit to 1000 rows per run
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      const result = await this.prisma.analyticsEvent.deleteMany({
        where: {
          createdAt: {
            lt: ninetyDaysAgo,
          },
        },
        // Note: Prisma doesn't support LIMIT on deleteMany,
        // so we'll rely on batch size constraints in the database
      });

      if (result.count > 0) {
        this.logger.log(`Cleaned up ${result.count} old analytics events`);
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to cleanup old analytics: ${err.message}`,
        err.stack
      );
      // Don't throw - allow maintenance to continue
    }
  }

  private async aggregateObservability() {
    try {
      if (!this.observability?.aggregateRecentEvents) {
        return;
      }

      this.logger.log("Aggregating observability events into metrics");
      await this.observability.aggregateRecentEvents();

      // Also clean old events (90 days+)
      if (this.observability?.cleanOldEvents) {
        await this.observability.cleanOldEvents();
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to aggregate observability: ${err.message}`,
        err.stack
      );
      // Don't throw - allow maintenance to continue
    }
  }

  /**
   * Stop the maintenance interval (for graceful shutdown)
   */
  onModuleDestroy() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      this.logger.log("Maintenance interval stopped");
    }
  }
}
