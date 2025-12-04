import { Injectable, Logger, HttpException, HttpStatus } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AuditService } from "../audit/audit.service";
import { AuthContextData } from "../context/auth-context.interface";

export type LimitCategory =
  | "agents"
  | "workflows"
  | "triggers"
  | "memory"
  | "apiKeys"
  | "monthlyTokens";

interface LimitCheckResult {
  allowed: boolean;
  softLimitExceeded: boolean;
  hardLimitExceeded: boolean;
  currentValue: number;
  maxValue: number;
  usagePercent: number;
}

@Injectable()
export class WorkspaceLimitService {
  private readonly logger = new Logger(WorkspaceLimitService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService
  ) {}

  /**
   * Get or create limits for a workspace
   */
  async getLimitsForWorkspace(workspaceId: string) {
    let limits = await this.prisma.workspaceLimit.findUnique({
      where: { workspaceId },
    });

    if (!limits) {
      // Get subscription to determine plan tier
      const subscription = await this.prisma.workspaceSubscription.findUnique({
        where: { workspaceId },
      });

      const planTier = this.determinePlanTier(subscription?.status);

      // Create default limits based on tier
      limits = await this.createDefaultLimits(workspaceId, planTier);
    }

    return limits;
  }

  /**
   * Determine plan tier from subscription status
   */
  private determinePlanTier(status?: string): string {
    if (!status || status === "inactive") {
      return "starter";
    }
    if (status === "trialing") {
      return "pro";
    }
    // For active subscriptions, default to pro
    // In production, this would check actual stripe price/plan
    return "pro";
  }

  /**
   * Create default limits for a workspace
   */
  private async createDefaultLimits(workspaceId: string, planTier: string) {
    const defaults = this.getDefaultLimitsByTier(planTier);

    return this.prisma.workspaceLimit.create({
      data: {
        workspaceId,
        planTier,
        ...defaults,
      },
    });
  }

  /**
   * Get default limits by plan tier
   */
  private getDefaultLimitsByTier(tier: string) {
    const tiers: Record<string, any> = {
      starter: {
        maxAgents: 5,
        maxWorkflows: 10,
        maxTriggers: 20,
        maxMemoryMB: 100,
        maxApiKeys: 5,
        maxMonthlyTokens: 1000000,
        softTokenThreshold: 0.8,
        hardTokenThreshold: 1.0,
      },
      pro: {
        maxAgents: 50,
        maxWorkflows: 100,
        maxTriggers: 200,
        maxMemoryMB: 1000,
        maxApiKeys: 50,
        maxMonthlyTokens: 10000000,
        softTokenThreshold: 0.8,
        hardTokenThreshold: 1.0,
      },
      enterprise: {
        maxAgents: 500,
        maxWorkflows: 1000,
        maxTriggers: 2000,
        maxMemoryMB: 10000,
        maxApiKeys: 500,
        maxMonthlyTokens: 100000000,
        softTokenThreshold: 0.8,
        hardTokenThreshold: 1.0,
      },
    };

    return tiers[tier] || tiers.starter;
  }

  /**
   * Enforce a limit for a specific category
   * Throws if hard limit exceeded
   * Sends notification if soft limit exceeded
   */
  async enforceLimit(
    ctx: AuthContextData,
    category: LimitCategory,
    currentValue: number
  ): Promise<void> {
    const limits = await this.getLimitsForWorkspace(ctx.workspaceId);
    const maxValue = this.getMaxValueForCategory(limits, category);

    const result = this.checkLimit(
      currentValue,
      maxValue,
      limits.softTokenThreshold,
      limits.hardTokenThreshold
    );

    // Hard limit exceeded - block the action
    if (result.hardLimitExceeded) {
      this.logger.warn(
        `Hard limit exceeded for workspace ${ctx.workspaceId}, category: ${category}`
      );

      // Audit log
      await this.audit.record(ctx, {
        action: "limit.blocked",
        entityType: "WorkspaceLimit",
        entityId: limits.id,
        metadata: {
          category,
          maxValue,
          currentValue,
          usagePercent: result.usagePercent,
        },
      });

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: "LIMIT_EXCEEDED",
          category,
          limit: maxValue,
          current: currentValue,
          message: `Workspace has reached its ${category} limit. Please upgrade your plan.`,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // Soft limit exceeded - warn but allow
    if (result.softLimitExceeded) {
      this.logger.warn(
        `Soft limit exceeded for workspace ${ctx.workspaceId}, category: ${category}`
      );

      // Send notification (non-blocking)
      this.notifications
        .sendToWorkspace(
          ctx.workspaceId,
          "limit.warning",
          "Workspace Limit Warning",
          `Your workspace is approaching its ${category} limit (${currentValue}/${maxValue}).`,
          {
            category,
            maxValue,
            currentValue,
            usagePercent: result.usagePercent,
          }
        )
        .catch((err) =>
          this.logger.error(
            `Failed to send limit warning notification: ${err.message}`
          )
        );
    }
  }

  /**
   * Get max value for a category from limits
   */
  private getMaxValueForCategory(
    limits: any,
    category: LimitCategory
  ): number {
    const mapping: Record<LimitCategory, string> = {
      agents: "maxAgents",
      workflows: "maxWorkflows",
      triggers: "maxTriggers",
      memory: "maxMemoryMB",
      apiKeys: "maxApiKeys",
      monthlyTokens: "maxMonthlyTokens",
    };

    return limits[mapping[category]] || 0;
  }

  /**
   * Check if a value exceeds limits
   */
  private checkLimit(
    currentValue: number,
    maxValue: number,
    softThreshold: number,
    hardThreshold: number
  ): LimitCheckResult {
    const usagePercent = maxValue > 0 ? currentValue / maxValue : 0;

    return {
      allowed: usagePercent < hardThreshold,
      softLimitExceeded: usagePercent >= softThreshold,
      hardLimitExceeded: usagePercent >= hardThreshold,
      currentValue,
      maxValue,
      usagePercent,
    };
  }

  /**
   * Check soft limit only (for warnings)
   */
  async checkSoftLimit(
    workspaceId: string,
    category: LimitCategory,
    currentValue: number
  ): Promise<boolean> {
    const limits = await this.getLimitsForWorkspace(workspaceId);
    const maxValue = this.getMaxValueForCategory(limits, category);
    const result = this.checkLimit(
      currentValue,
      maxValue,
      limits.softTokenThreshold,
      limits.hardTokenThreshold
    );

    return result.softLimitExceeded;
  }

  /**
   * Check hard limit only (for blocking)
   */
  async checkHardLimit(
    workspaceId: string,
    category: LimitCategory,
    currentValue: number
  ): Promise<boolean> {
    const limits = await this.getLimitsForWorkspace(workspaceId);
    const maxValue = this.getMaxValueForCategory(limits, category);
    const result = this.checkLimit(
      currentValue,
      maxValue,
      limits.softTokenThreshold,
      limits.hardTokenThreshold
    );

    return result.hardLimitExceeded;
  }

  /**
   * Get current usage for all categories
   */
  async getCurrentUsage(workspaceId: string) {
    const [
      agentCount,
      workflowCount,
      triggerCount,
      memoryBytes,
      apiKeyCount,
      monthlyTokens,
    ] = await Promise.all([
      this.prisma.agentConfig.count({ where: { workspaceId } }),
      this.prisma.workflow.count({ where: { workspaceId } }),
      this.prisma.eventTrigger.count({ where: { workspaceId } }),
      this.getMemoryUsageBytes(workspaceId),
      this.prisma.apiKey.count({
        where: { workspaceId, revokedAt: null },
      }),
      this.getMonthlyTokenUsage(workspaceId),
    ]);

    return {
      agents: agentCount,
      workflows: workflowCount,
      triggers: triggerCount,
      memoryMB: Math.ceil(memoryBytes / (1024 * 1024)),
      apiKeys: apiKeyCount,
      monthlyTokens,
    };
  }

  /**
   * Get memory usage in bytes
   */
  private async getMemoryUsageBytes(workspaceId: string): Promise<number> {
    const memories = await this.prisma.agentMemory.findMany({
      where: { workspaceId },
      select: { content: true },
    });

    // Rough estimation: count string bytes
    return memories.reduce((total, mem) => {
      return total + Buffer.byteLength(mem.content, "utf8");
    }, 0);
  }

  /**
   * Get monthly token usage
   */
  private async getMonthlyTokenUsage(workspaceId: string): Promise<number> {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const result = await this.prisma.billingUsage.aggregate({
      where: {
        workspaceId,
        createdAt: {
          gte: firstDayOfMonth,
        },
      },
      _sum: {
        units: true,
      },
    });

    return result._sum.units || 0;
  }

  /**
   * Update workspace limits (admin only)
   */
  async updateLimits(workspaceId: string, updates: Partial<any>) {
    const limits = await this.getLimitsForWorkspace(workspaceId);

    return this.prisma.workspaceLimit.update({
      where: { id: limits.id },
      data: updates,
    });
  }
}
