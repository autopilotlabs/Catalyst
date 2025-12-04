import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { JobQueueService } from "./job-queue.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuthContext } from "../context/auth-context.decorator";
import { AuthContextGuard } from "../context/auth-context.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { SubscriptionGuard } from "../guards/subscription.guard";
import { RateLimitGuard } from "../guards/rate-limit.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { RateLimit } from "../rate-limit/rate-limit.decorator";
import { AuthContextData } from "../context/auth-context.interface";

@Controller("jobs")
@UseGuards(AuthContextGuard, SubscriptionGuard, PermissionsGuard, RateLimitGuard)
@RequirePermission("workspace.manage")
export class JobController {
  constructor(
    private readonly jobQueue: JobQueueService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * List jobs for workspace
   */
  @Get()
  @RateLimit("api.jobs", 120)
  async listJobs(
    @AuthContext() ctx: AuthContextData,
    @Query("status") status?: string,
    @Query("type") type?: string,
    @Query("limit") limitStr?: string
  ) {
    const limit = limitStr ? parseInt(limitStr, 10) : 50;

    const where: any = {
      workspaceId: ctx.workspaceId,
    };

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    const jobs = await this.prisma.job.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: Math.min(limit, 100),
      select: {
        id: true,
        type: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        scheduledAt: true,
        createdAt: true,
        updatedAt: true,
        lastError: true,
      },
    });

    return jobs;
  }

  /**
   * Get job detail
   */
  @Get(":id")
  @RateLimit("api.jobs", 120)
  async getJob(@AuthContext() ctx: AuthContextData, @Param("id") id: string) {
    const job = await this.prisma.job.findFirst({
      where: {
        id,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!job) {
      throw new Error("Job not found");
    }

    return job;
  }

  /**
   * Retry a dead/failed job
   */
  @Post(":id/retry")
  @RateLimit("api.jobs", 120)
  @HttpCode(HttpStatus.OK)
  async retryJob(@AuthContext() ctx: AuthContextData, @Param("id") id: string) {
    await this.jobQueue.retryJob(id, ctx.workspaceId);

    return {
      success: true,
      message: "Job queued for retry",
    };
  }
}
