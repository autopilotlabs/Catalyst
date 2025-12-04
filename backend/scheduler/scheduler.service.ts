import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AgentExecutionService } from "../agent/agent-execution.service";
import { AuthContextData } from "../context/auth-context.interface";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: AgentExecutionService,
    private readonly auditService: AuditService
  ) {
    this.start();
  }

  start() {
    if (this.intervalId) {
      this.logger.warn("Scheduler already running");
      return;
    }
    
    this.logger.log("Starting scheduler service - checking every 30 seconds");
    this.intervalId = setInterval(() => this.tick(), 30_000); // every 30s
    
    // Run immediately on startup
    this.tick();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.log("Scheduler service stopped");
    }
  }

  async tick() {
    try {
      const now = new Date();
      const schedules = await this.prisma.scheduledRun.findMany({
        where: { enabled: true },
        include: {
          agent: true,
        },
      });

      this.logger.debug(`Checking ${schedules.length} enabled schedules`);

      for (const sched of schedules) {
        if (this.isDue(sched, now)) {
          this.logger.log(`Schedule ${sched.id} is due, executing...`);
          // Run in background without awaiting
          this.runScheduledJob(sched).catch((error) => {
            this.logger.error(
              `Error running scheduled job ${sched.id}: ${error.message}`,
              error.stack
            );
          });
        }
      }
    } catch (error: any) {
      this.logger.error(`Error in scheduler tick: ${error.message}`, error.stack);
    }
  }

  isDue(sched: any, now: Date): boolean {
    // Parse cron-like expression: "*/X * * * *" (every X minutes)
    const match = sched.schedule.match(/^\*\/(\d+) \* \* \* \*$/);
    if (!match) {
      this.logger.warn(
        `Invalid schedule format for ${sched.id}: ${sched.schedule}. Expected "*/X * * * *"`
      );
      return false;
    }

    const intervalMinutes = parseInt(match[1], 10);

    // If never run before, it's due
    if (!sched.lastRunAt) {
      return true;
    }

    // Calculate time since last run
    const lastRun = new Date(sched.lastRunAt);
    const diffMinutes = (now.getTime() - lastRun.getTime()) / (1000 * 60);

    return diffMinutes >= intervalMinutes;
  }

  async runScheduledJob(sched: any) {
    try {
      // Create auth context for the scheduled run
      const ctx: AuthContextData = {
        userId: sched.userId,
        workspaceId: sched.workspaceId,
        membership: {
          role: "owner", // System runs always as owner
        },
      };

      this.logger.log(
        `Creating agent run for schedule ${sched.id} with agent ${sched.agentId}`
      );

      // Create a new AgentRun
      const run = await this.prisma.agentRun.create({
        data: {
          userId: sched.userId,
          workspaceId: sched.workspaceId,
          agentId: sched.agentId,
          input: sched.input,
          status: "pending",
        },
      });

      this.logger.log(`Created agent run ${run.id}, executing...`);

      // Audit log for schedule run fired
      await this.auditService.logScheduleEvent(ctx, {
        action: "schedule.run.fired",
        entityType: "schedule",
        entityId: sched.id,
        metadata: {
          runId: run.id,
          agentId: sched.agentId,
        },
      });

      // Execute the run
      await this.executor.multiStepRun(ctx, run.id);

      // Update lastRunAt timestamp
      await this.prisma.scheduledRun.update({
        where: { id: sched.id },
        data: { lastRunAt: new Date() },
      });

      this.logger.log(
        `Scheduled agent run completed successfully: ${sched.id} -> ${run.id}`
      );
    } catch (error: any) {
      this.logger.error(
        `Error executing scheduled job ${sched.id}: ${error.message}`,
        error.stack
      );

      // Update lastRunAt even on error to prevent retry loops
      await this.prisma.scheduledRun.update({
        where: { id: sched.id },
        data: { lastRunAt: new Date() },
      });
    }
  }
}
