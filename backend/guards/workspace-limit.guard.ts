import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { WorkspaceLimitService, LimitCategory } from "../limits/workspace-limit.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuthContextData } from "../context/auth-context.interface";

export const LIMIT_CHECK_KEY = "limit_check";

export interface LimitCheckMetadata {
  category: LimitCategory;
  skip?: boolean;
}

/**
 * Decorator to apply workspace limit checking
 */
export const CheckLimit = (category: LimitCategory) =>
  Reflect.metadata(LIMIT_CHECK_KEY, { category } as LimitCheckMetadata);

/**
 * Decorator to skip workspace limit checking
 */
export const SkipLimitCheck = () =>
  Reflect.metadata(LIMIT_CHECK_KEY, { skip: true } as LimitCheckMetadata);

@Injectable()
export class WorkspaceLimitGuard implements CanActivate {
  private readonly logger = new Logger(WorkspaceLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly limitService: WorkspaceLimitService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get limit check metadata from decorator
    const limitMetadata = this.reflector.get<LimitCheckMetadata>(
      LIMIT_CHECK_KEY,
      context.getHandler()
    );

    // If no metadata or skip flag, allow access
    if (!limitMetadata || limitMetadata.skip) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authContext: AuthContextData = request.authContext;

    // If no auth context, skip (other guards will handle)
    if (!authContext || !authContext.workspaceId) {
      this.logger.warn("No auth context found for limit checking");
      return true;
    }

    const { category } = limitMetadata;

    // Get current usage for the category
    const currentValue = await this.getCurrentUsageForCategory(
      authContext.workspaceId,
      category
    );

    // Enforce limit (will throw if hard limit exceeded)
    await this.limitService.enforceLimit(authContext, category, currentValue);

    return true;
  }

  /**
   * Get current usage for a specific category
   */
  private async getCurrentUsageForCategory(
    workspaceId: string,
    category: LimitCategory
  ): Promise<number> {
    switch (category) {
      case "agents":
        return this.prisma.agentConfig.count({ where: { workspaceId } });

      case "workflows":
        return this.prisma.workflow.count({ where: { workspaceId } });

      case "triggers":
        return this.prisma.eventTrigger.count({ where: { workspaceId } });

      case "memory":
        return this.getMemoryUsageMB(workspaceId);

      case "apiKeys":
        return this.prisma.apiKey.count({
          where: { workspaceId, revokedAt: null },
        });

      case "monthlyTokens":
        return this.getMonthlyTokenUsage(workspaceId);

      default:
        this.logger.warn(`Unknown limit category: ${category}`);
        return 0;
    }
  }

  /**
   * Get memory usage in MB
   */
  private async getMemoryUsageMB(workspaceId: string): Promise<number> {
    const memories = await this.prisma.agentMemory.findMany({
      where: { workspaceId },
      select: { content: true },
    });

    const totalBytes = memories.reduce((total, mem) => {
      return total + Buffer.byteLength(mem.content, "utf8");
    }, 0);

    return Math.ceil(totalBytes / (1024 * 1024));
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
}
