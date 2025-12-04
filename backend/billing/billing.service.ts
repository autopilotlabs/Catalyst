import { Injectable, Logger, Inject, forwardRef } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthContextData } from "../context/auth-context.interface";

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => require('../observability/observability.service').ObservabilityService))
    private readonly observability: any
  ) {}

  /**
   * Get or create the active billing cycle for a workspace.
   * Active cycle = closed = false.
   * If no active cycle exists, creates a new monthly cycle.
   */
  async getOrCreateActiveCycle(workspaceId: string) {
    // Check for existing open cycle
    let cycle = await this.prisma.billingCycle.findFirst({
      where: {
        workspaceId,
        closed: false,
      },
      orderBy: {
        periodStart: "desc",
      },
    });

    if (!cycle) {
      // Create new monthly cycle
      const periodStart = new Date();
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + 30); // 30-day cycle

      cycle = await this.prisma.billingCycle.create({
        data: {
          workspaceId,
          periodStart,
          periodEnd,
          totalCost: 0,
          closed: false,
        },
      });

      this.logger.log(
        `Created new billing cycle ${cycle.id} for workspace ${workspaceId}`
      );
    }

    return cycle;
  }

  /**
   * Record a usage event and accrue cost to the active billing cycle.
   */
  async recordUsage(
    ctx: AuthContextData,
    category: string,
    units: number,
    cost: number,
    metadata?: any
  ) {
    try {
      // Get or create active cycle
      const cycle = await this.getOrCreateActiveCycle(ctx.workspaceId);

      // Create usage entry
      const usage = await this.prisma.billingUsage.create({
        data: {
          workspaceId: ctx.workspaceId,
          billingCycleId: cycle.id,
          category,
          units,
          cost,
          metadata: metadata || {},
        },
      });

      // Update cycle total cost
      await this.prisma.billingCycle.update({
        where: { id: cycle.id },
        data: {
          totalCost: {
            increment: cost,
          },
        },
      });

      this.logger.debug(
        `Recorded usage: ${category} (${units} units, $${cost.toFixed(4)}) for workspace ${ctx.workspaceId}`
      );

      // Log observability event
      if (this.observability?.logEvent) {
        await this.observability.logEvent(ctx, {
          category: "billing",
          eventType: "billing.usage",
          success: true,
          metadata: { category, units, cost },
        });
      }

      return usage;
    } catch (error: any) {
      // NEVER throw - billing failures must not break main flows
      this.logger.error(
        `Failed to record usage for workspace ${ctx.workspaceId}: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Close billing cycles that have passed their periodEnd.
   * This is a maintenance function typically called by a scheduled job.
   * Returns cycles that need invoice generation.
   */
  async closeCycles() {
    const now = new Date();

    const expiredCycles = await this.prisma.billingCycle.findMany({
      where: {
        closed: false,
        periodEnd: {
          lt: now,
        },
      },
    });

    for (const cycle of expiredCycles) {
      await this.prisma.billingCycle.update({
        where: { id: cycle.id },
        data: { closed: true },
      });

      this.logger.log(
        `Closed billing cycle ${cycle.id} for workspace ${cycle.workspaceId}`
      );
    }

    return expiredCycles;
  }

  /**
   * Schedule cycle closure and invoice generation for a workspace.
   * Typically called by a cron job.
   */
  async scheduleCycleClosure(workspaceId: string) {
    const now = new Date();

    const expiredCycles = await this.prisma.billingCycle.findMany({
      where: {
        workspaceId,
        closed: false,
        periodEnd: {
          lt: now,
        },
      },
    });

    const closedCycles = [];

    for (const cycle of expiredCycles) {
      // Close the cycle
      await this.prisma.billingCycle.update({
        where: { id: cycle.id },
        data: { closed: true },
      });

      this.logger.log(
        `Closed billing cycle ${cycle.id} for workspace ${workspaceId}`
      );

      closedCycles.push(cycle);
    }

    return closedCycles;
  }

  /**
   * Get list of billing cycles for a workspace.
   */
  async listCycles(ctx: AuthContextData) {
    return this.prisma.billingCycle.findMany({
      where: {
        workspaceId: ctx.workspaceId,
      },
      orderBy: {
        periodStart: "desc",
      },
      take: 12, // Last 12 cycles (1 year)
    });
  }

  /**
   * Get a specific billing cycle with all usage entries.
   */
  async getCycle(ctx: AuthContextData, cycleId: string) {
    return this.prisma.billingCycle.findFirst({
      where: {
        id: cycleId,
        workspaceId: ctx.workspaceId,
      },
      include: {
        usageEntries: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });
  }

  /**
   * Get usage entries for the active billing cycle.
   */
  async getCurrentUsage(ctx: AuthContextData) {
    const cycle = await this.getOrCreateActiveCycle(ctx.workspaceId);

    return this.prisma.billingUsage.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        billingCycleId: cycle.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 1000, // Limit to recent 1000 entries
    });
  }
}
