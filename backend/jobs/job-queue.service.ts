import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

type JobHandler = (job: any, payload: any) => Promise<void>;

interface EnqueueOptions {
  delayMs?: number;
  maxAttempts?: number;
}

@Injectable()
export class JobQueueService implements OnModuleInit {
  private readonly logger = new Logger(JobQueueService.name);
  private handlers = new Map<string, JobHandler>();
  private isRunning = false;
  private workerInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(forwardRef(() => require('../observability/observability.service').ObservabilityService))
    private readonly observability: any
  ) {}

  async onModuleInit() {
    // Start worker loop on module initialization
    this.startWorkerLoop();
  }

  /**
   * Enqueue a new job
   */
  async enqueue(
    type: string,
    payload: any,
    workspaceId?: string,
    options: EnqueueOptions = {}
  ): Promise<string> {
    const scheduledAt = options.delayMs
      ? new Date(Date.now() + options.delayMs)
      : new Date();

    const job = await this.prisma.job.create({
      data: {
        type,
        payload,
        workspaceId: workspaceId || null,
        scheduledAt,
        maxAttempts: options.maxAttempts || 5,
      },
    });

    this.logger.log(
      `Job enqueued: ${job.id} (type: ${type}, workspace: ${workspaceId || "global"})`
    );

    return job.id;
  }

  /**
   * Register a job handler
   */
  registerHandler(type: string, handler: JobHandler) {
    this.handlers.set(type, handler);
    this.logger.log(`Registered handler for job type: ${type}`);
  }

  /**
   * Start the background worker loop
   */
  startWorkerLoop() {
    if (this.isRunning) {
      this.logger.warn("Worker loop already running");
      return;
    }

    this.isRunning = true;
    this.logger.log("Starting job worker loop");

    // Run every 2 seconds
    this.workerInterval = setInterval(() => {
      this.processJobs().catch((error) => {
        this.logger.error(`Error in worker loop: ${error.message}`, error.stack);
      });
    }, 2000);
  }

  /**
   * Stop the worker loop (for graceful shutdown)
   */
  stopWorkerLoop() {
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = null;
    }
    this.isRunning = false;
    this.logger.log("Stopped job worker loop");
  }

  /**
   * Process pending jobs
   */
  private async processJobs() {
    try {
      // Fetch pending jobs
      const jobs = await this.prisma.job.findMany({
        where: {
          status: "pending",
          scheduledAt: {
            lte: new Date(),
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        take: 20, // Process 20 jobs per cycle
      });

      if (jobs.length === 0) {
        return;
      }

      this.logger.debug(`Processing ${jobs.length} pending jobs`);

      // Process jobs in parallel
      await Promise.all(
        jobs.map((job) => this.processJob(job).catch((error) => {
          this.logger.error(
            `Fatal error processing job ${job.id}: ${error.message}`,
            error.stack
          );
        }))
      );
    } catch (error: any) {
      this.logger.error(
        `Error fetching jobs: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: any) {
    const handler = this.handlers.get(job.type);

    if (!handler) {
      this.logger.warn(
        `No handler registered for job type: ${job.type}, marking as dead`
      );
      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: "dead",
          lastError: `No handler registered for type: ${job.type}`,
          updatedAt: new Date(),
        },
      });
      return;
    }

    // Mark as running
    try {
      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: "running",
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      // Job might have been picked up by another worker
      this.logger.debug(`Failed to mark job ${job.id} as running, skipping`);
      return;
    }

    // Execute handler
    try {
      this.logger.log(`Executing job ${job.id} (type: ${job.type})`);

      const startTime = Date.now();
      await handler(job, job.payload);
      const duration = Date.now() - startTime;

      // Mark as success
      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: "success",
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Job ${job.id} completed successfully`);

      // Log observability event
      if (job.workspaceId && this.observability?.logEvent) {
        await this.observability.logEvent(
          { userId: null, workspaceId: job.workspaceId, role: "system" } as any,
          {
            category: "job",
            eventType: "job.completed",
            entityId: job.id,
            entityType: "job",
            durationMs: duration,
            success: true,
            metadata: { type: job.type },
          }
        );
      }

      // Audit log
      if (job.workspaceId) {
        await this.audit.record(
          { userId: null, workspaceId: job.workspaceId, role: "system" } as any,
          {
            action: "job.completed",
            entityType: "job",
            entityId: job.id,
            metadata: { type: job.type },
          }
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Job ${job.id} failed: ${error.message}`,
        error.stack
      );

      const newAttempts = job.attempts + 1;
      const maxAttempts = job.maxAttempts || 5;

      if (newAttempts < maxAttempts) {
        // Retry with exponential backoff
        const backoffMs = Math.pow(2, newAttempts) * 1000; // 2s, 4s, 8s, 16s, 32s
        const nextScheduledAt = new Date(Date.now() + backoffMs);

        await this.prisma.job.update({
          where: { id: job.id },
          data: {
            status: "pending",
            attempts: newAttempts,
            lastError: error.message,
            scheduledAt: nextScheduledAt,
            updatedAt: new Date(),
          },
        });

        this.logger.log(
          `Job ${job.id} scheduled for retry ${newAttempts}/${maxAttempts} in ${backoffMs}ms`
        );
      } else {
        // Mark as dead (exceeded max attempts)
        await this.prisma.job.update({
          where: { id: job.id },
          data: {
            status: "dead",
            attempts: newAttempts,
            lastError: error.message,
            updatedAt: new Date(),
          },
        });

        this.logger.error(
          `Job ${job.id} marked as dead after ${newAttempts} attempts`
        );

        // Audit log failure
        if (job.workspaceId) {
          await this.audit.record(
            { userId: null, workspaceId: job.workspaceId, role: "system" } as any,
            {
              action: "job.failed",
              entityType: "job",
              entityId: job.id,
              metadata: {
                type: job.type,
                attempts: newAttempts,
                error: error.message,
              },
            }
          );
        }
      }
    }
  }

  /**
   * Retry a dead or failed job
   */
  async retryJob(jobId: string, workspaceId?: string): Promise<void> {
    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        ...(workspaceId && { workspaceId }),
      },
    });

    if (!job) {
      throw new Error("Job not found");
    }

    if (job.status !== "dead" && job.status !== "failed") {
      throw new Error("Can only retry dead or failed jobs");
    }

    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: "pending",
        attempts: 0,
        scheduledAt: new Date(),
        lastError: null,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Job ${jobId} reset for retry`);
  }
}
