import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { MaintenanceService } from "./maintenance.service";
import { AuthContextGuard } from "../context/auth-context.guard";
import { SubscriptionGuard } from "../guards/subscription.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { RateLimitGuard } from "../guards/rate-limit.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { RateLimit } from "../rate-limit/rate-limit.decorator";

interface RunMaintenanceDto {
  scope?: "billing" | "jobs" | "analytics" | "all";
}

@Controller("maintenance")
@UseGuards(AuthContextGuard, SubscriptionGuard, PermissionsGuard, RateLimitGuard)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post("run")
  @RequirePermission("workspace.manage")
  @RateLimit("maintenance.run", 10)
  @HttpCode(HttpStatus.OK)
  async runMaintenance(@Body() body: RunMaintenanceDto) {
    const scope = body.scope || "all";

    // For now, we always run full maintenance
    // In the future, could implement selective scope-based runs
    await this.maintenanceService.runMaintenance("manual");

    return {
      ok: true,
      scope,
      message: "Maintenance tasks executed successfully",
    };
  }
}
