import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common";
import { WorkspaceLimitService } from "./workspace-limit.service";
import { AuthContextGuard } from "../context/auth-context.guard";
import { SubscriptionGuard } from "../guards/subscription.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { AuthContextData } from "../context/auth-context.interface";

@Controller("limits")
@UseGuards(AuthContextGuard, SubscriptionGuard, PermissionsGuard)
export class WorkspaceLimitController {
  constructor(private readonly limitService: WorkspaceLimitService) {}

  /**
   * Get workspace limits and current usage
   */
  @Get()
  async getLimits(@Request() req: any) {
    const ctx: AuthContextData = req.authContext;

    const [limits, usage] = await Promise.all([
      this.limitService.getLimitsForWorkspace(ctx.workspaceId),
      this.limitService.getCurrentUsage(ctx.workspaceId),
    ]);

    return {
      limits,
      usage,
    };
  }

  /**
   * Update workspace limits (admin only)
   */
  @Patch()
  @RequirePermission("workspace.manage")
  async updateLimits(@Request() req: any, @Body() updates: any) {
    const ctx: AuthContextData = req.authContext;

    const updatedLimits = await this.limitService.updateLimits(
      ctx.workspaceId,
      updates
    );

    return updatedLimits;
  }
}
