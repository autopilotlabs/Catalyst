import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ObservabilityService } from "./observability.service";
import { AuthContext } from "../context/auth-context.decorator";
import { AuthContextGuard } from "../context/auth-context.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { RateLimitGuard } from "../guards/rate-limit.guard";
import { RateLimit } from "../rate-limit/rate-limit.decorator";
import { AuthContextData } from "../context/auth-context.interface";

@Controller("observability")
@UseGuards(AuthContextGuard, PermissionsGuard, RateLimitGuard)
export class ObservabilityController {
  constructor(private readonly observability: ObservabilityService) {}

  /**
   * GET /observability/events
   * List observability events with filters
   */
  @Get("events")
  @RequirePermission("workspace.analytics")
  @RateLimit("observability.events", 120)
  async listEvents(
    @AuthContext() ctx: AuthContextData,
    @Query("category") category?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limit?: string
  ) {
    const filters: any = {};

    if (category) {
      filters.category = category;
    }

    if (from) {
      const fromDate = new Date(from);
      if (isNaN(fromDate.getTime())) {
        throw new BadRequestException("Invalid 'from' date format");
      }
      filters.from = fromDate;
    }

    if (to) {
      const toDate = new Date(to);
      if (isNaN(toDate.getTime())) {
        throw new BadRequestException("Invalid 'to' date format");
      }
      filters.to = toDate;
    }

    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
        throw new BadRequestException("Invalid limit (1-1000)");
      }
      filters.limit = limitNum;
    }

    const events = await this.observability.listEvents(ctx, filters);

    return {
      events: events.map((e) => ({
        id: e.id,
        timestamp: e.timestamp,
        category: e.category,
        eventType: e.eventType,
        entityId: e.entityId,
        entityType: e.entityType,
        durationMs: e.durationMs,
        success: e.success,
        metadata: e.metadata,
      })),
      count: events.length,
    };
  }

  /**
   * GET /observability/metrics
   * List metrics for a category and time range
   */
  @Get("metrics")
  @RequirePermission("workspace.analytics")
  @RateLimit("observability.metrics", 60)
  async listMetrics(
    @AuthContext() ctx: AuthContextData,
    @Query("category") category: string,
    @Query("range") range: string
  ) {
    if (!category) {
      throw new BadRequestException("category is required");
    }

    if (!["1d", "7d", "30d"].includes(range)) {
      throw new BadRequestException("range must be 1d, 7d, or 30d");
    }

    const metrics = await this.observability.listMetrics(ctx, {
      category,
      range: range as "1d" | "7d" | "30d",
    });

    return {
      category,
      range,
      metrics: metrics.map((m) => ({
        periodStart: m.periodStart,
        periodEnd: m.periodEnd,
        value: m.value,
        metadata: m.metadata,
      })),
      total: metrics.reduce((sum, m) => sum + m.value, 0),
    };
  }

  /**
   * GET /observability/trace/:entityType/:entityId
   * Get correlated trace for an entity
   */
  @Get("trace/:entityType/:entityId")
  @RequirePermission("workspace.analytics")
  @RateLimit("observability.trace", 30)
  async getTrace(
    @AuthContext() ctx: AuthContextData,
    @Param("entityType") entityType: string,
    @Param("entityId") entityId: string
  ) {
    const trace = await this.observability.prepareCorrelatedTrace(
      ctx,
      entityType,
      entityId
    );

    return trace;
  }

  /**
   * GET /observability/summary
   * Get summary stats for the workspace
   */
  @Get("summary")
  @RequirePermission("workspace.analytics")
  @RateLimit("observability.summary", 60)
  async getSummary(
    @AuthContext() ctx: AuthContextData,
    @Query("range") range?: string
  ) {
    if (range && !["1d", "7d", "30d"].includes(range)) {
      throw new BadRequestException("range must be 1d, 7d, or 30d");
    }

    const stats = await this.observability.getSummaryStats(
      ctx,
      (range as "1d" | "7d" | "30d") || "7d"
    );

    return stats;
  }
}
