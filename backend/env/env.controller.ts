import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { EnvService } from "./env.service";
import { AuthContext } from "../context/auth-context.decorator";
import { AuthContextGuard } from "../context/auth-context.guard";
import { SubscriptionGuard } from "../guards/subscription.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { RateLimitGuard } from "../guards/rate-limit.guard";
import { RateLimit } from "../rate-limit/rate-limit.decorator";
import { AuthContextData } from "../context/auth-context.interface";

@Controller("env")
@UseGuards(AuthContextGuard, SubscriptionGuard, PermissionsGuard, RateLimitGuard)
export class EnvController {
  constructor(private readonly envService: EnvService) {}

  /**
   * List all environment variables (metadata only, no values)
   * GET /env
   */
  @Get()
  @RequirePermission("workspace.manage")
  @RateLimit("env.list", 60)
  async list(@AuthContext() ctx: AuthContextData) {
    const vars = await this.envService.listVariables(ctx);
    return { data: vars };
  }

  /**
   * Get a specific environment variable (with decrypted value)
   * GET /env/:name
   */
  @Get(":name")
  @RequirePermission("workspace.manage")
  @RateLimit("env.read", 60)
  async get(@AuthContext() ctx: AuthContextData, @Param("name") name: string) {
    const result = await this.envService.getVariable(ctx, name);
    return { data: result };
  }

  /**
   * Create or update an environment variable
   * POST /env
   */
  @Post()
  @RequirePermission("workspace.manage")
  @RateLimit("env.write", 60)
  async set(
    @AuthContext() ctx: AuthContextData,
    @Body() body: { name: string; value: string }
  ) {
    const result = await this.envService.setVariable(
      ctx,
      body.name,
      body.value
    );
    return { data: result };
  }

  /**
   * Delete an environment variable
   * DELETE /env/:name
   */
  @Delete(":name")
  @RequirePermission("workspace.manage")
  @RateLimit("env.delete", 60)
  async delete(
    @AuthContext() ctx: AuthContextData,
    @Param("name") name: string
  ) {
    await this.envService.deleteVariable(ctx, name);
    return { data: { success: true } };
  }
}
