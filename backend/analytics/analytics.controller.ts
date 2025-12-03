import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AuthContextGuard } from "../context/auth-context.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { AuthContext } from "../context/auth-context.decorator";
import { AuthContextData } from "../context/auth-context.interface";
import { AnalyticsService } from "./analytics.service";

@Controller("analytics")
@UseGuards(AuthContextGuard, PermissionsGuard)
@RequirePermission("workspace.analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("summary")
  async getSummary(@AuthContext() ctx: AuthContextData) {
    const data = await this.analyticsService.getSummary(ctx.workspaceId);
    return { data };
  }

  @Get("timeseries")
  async getTimeSeries(
    @AuthContext() ctx: AuthContextData,
    @Query("days") days?: string
  ) {
    const daysNum = days ? parseInt(days, 10) : 30;
    const data = await this.analyticsService.getTimeSeries(
      ctx.workspaceId,
      daysNum
    );
    return { data };
  }

  @Get("top-agents")
  async getTopAgents(
    @AuthContext() ctx: AuthContextData,
    @Query("limit") limit?: string
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const data = await this.analyticsService.getTopAgents(
      ctx.workspaceId,
      limitNum
    );
    return { data };
  }

  @Get("top-workflows")
  async getTopWorkflows(
    @AuthContext() ctx: AuthContextData,
    @Query("limit") limit?: string
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const data = await this.analyticsService.getTopWorkflows(
      ctx.workspaceId,
      limitNum
    );
    return { data };
  }

  @Get("activity")
  async getRecentActivity(
    @AuthContext() ctx: AuthContextData,
    @Query("limit") limit?: string
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const data = await this.analyticsService.getRecentActivity(
      ctx.workspaceId,
      limitNum
    );
    return { data };
  }
}
