import { Injectable, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthContextData } from "../context/auth-context.interface";

// Rate limit keys
export const RATE_KEY_AGENT_RUN = "agent.run";
export const RATE_KEY_AGENT_STREAM = "agent.stream";
export const RATE_KEY_WORKFLOW_RUN = "workflow.run";
export const RATE_KEY_SEARCH = "search.query";
export const RATE_KEY_API_REQUESTS = "api.request";
export const RATE_KEY_EVENT_TRIGGER = "event.trigger";
export const RATE_KEY_MEMORY = "memory.operation";
export const RATE_KEY_PLUGIN = "plugin.execute";
export const RATE_KEY_NOTIFICATION = "notification.fetch";

// Default rate limits (per minute)
export const DEFAULT_LIMITS: Record<string, number> = {
  [RATE_KEY_AGENT_RUN]: 60,
  [RATE_KEY_AGENT_STREAM]: 30,
  [RATE_KEY_WORKFLOW_RUN]: 30,
  [RATE_KEY_SEARCH]: 120,
  [RATE_KEY_MEMORY]: 200,
  [RATE_KEY_PLUGIN]: 300,
  [RATE_KEY_NOTIFICATION]: 100,
  [RATE_KEY_EVENT_TRIGGER]: 60,
  [RATE_KEY_API_REQUESTS]: 1000,
};

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly PERIOD_DURATION_MS = 60 * 1000; // 1 minute

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /**
   * Check rate limit and increment counter
   * @param ctx Auth context
   * @param key Rate limit key
   * @param limit Maximum allowed requests in the period
   * @throws HttpException with 429 if limit exceeded
   */
  async checkAndIncrement(
    ctx: AuthContextData,
    key: string,
    limit: number
  ): Promise<void> {
    const now = new Date();
    const periodStart = new Date(
      Math.floor(now.getTime() / this.PERIOD_DURATION_MS) *
        this.PERIOD_DURATION_MS
    );
    const periodEnd = new Date(periodStart.getTime() + this.PERIOD_DURATION_MS);

    try {
      // Try to find existing counter for this period
      let counter = await this.prisma.rateLimitCounter.findUnique({
        where: {
          workspaceId_key_periodStart: {
            workspaceId: ctx.workspaceId,
            key,
            periodStart,
          },
        },
      });

      if (!counter) {
        // Create new counter for this period
        counter = await this.prisma.rateLimitCounter.create({
          data: {
            workspaceId: ctx.workspaceId,
            key,
            count: 1,
            periodStart,
            periodEnd,
          },
        });

        this.logger.debug(
          `Created new rate limit counter: ${key} for workspace ${ctx.workspaceId}`
        );
        return;
      }

      // Check if limit exceeded
      if (counter.count >= limit) {
        // Log violation to audit
        await this.audit.record(ctx, {
          action: "rate_limit_exceeded",
          entityType: "rate_limit",
          entityId: counter.id,
          metadata: {
            key,
            limit,
            count: counter.count,
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
          },
        });

        this.logger.warn(
          `Rate limit exceeded for workspace ${ctx.workspaceId}, key: ${key}, limit: ${limit}`
        );

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: "Rate limit exceeded. Please wait a moment and try again.",
            error: "Too Many Requests",
            retryAfter: Math.ceil(
              (periodEnd.getTime() - now.getTime()) / 1000
            ),
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }

      // Increment counter
      await this.prisma.rateLimitCounter.update({
        where: { id: counter.id },
        data: {
          count: { increment: 1 },
        },
      });

      this.logger.debug(
        `Rate limit counter incremented: ${key} for workspace ${ctx.workspaceId}, count: ${counter.count + 1}/${limit}`
      );
    } catch (error) {
      // If it's already a rate limit error, rethrow it
      if (error instanceof HttpException && error.getStatus() === 429) {
        throw error;
      }

      // For other errors, log but don't block the request
      this.logger.error(
        `Failed to check rate limit: ${error.message}`,
        error.stack
      );
      // Continue without rate limiting on error to avoid service disruption
    }
  }

  /**
   * Get current usage for a key
   */
  async getCurrentUsage(
    workspaceId: string,
    key: string
  ): Promise<{ count: number; limit: number; remaining: number }> {
    const now = new Date();
    const periodStart = new Date(
      Math.floor(now.getTime() / this.PERIOD_DURATION_MS) *
        this.PERIOD_DURATION_MS
    );

    const counter = await this.prisma.rateLimitCounter.findUnique({
      where: {
        workspaceId_key_periodStart: {
          workspaceId,
          key,
          periodStart,
        },
      },
    });

    const limit = DEFAULT_LIMITS[key] || 100;
    const count = counter?.count || 0;

    return {
      count,
      limit,
      remaining: Math.max(0, limit - count),
    };
  }

  /**
   * Reset counters for a workspace (admin function)
   */
  async resetCounters(workspaceId: string): Promise<void> {
    await this.prisma.rateLimitCounter.deleteMany({
      where: { workspaceId },
    });

    this.logger.log(`Reset all rate limit counters for workspace ${workspaceId}`);
  }

  /**
   * Clean up old counters (should be run periodically)
   */
  async cleanupOldCounters(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    const result = await this.prisma.rateLimitCounter.deleteMany({
      where: {
        periodEnd: {
          lt: cutoff,
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old rate limit counters`);
  }
}
