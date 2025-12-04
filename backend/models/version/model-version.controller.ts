import { Controller, Post, Get, Body, Param, UseGuards } from "@nestjs/common";
import { AuthContextGuard } from "../../context/auth-context.guard";
import { SubscriptionGuard } from "../../guards/subscription.guard";
import { PermissionsGuard } from "../../guards/permissions.guard";
import { RateLimitGuard } from "../../guards/rate-limit.guard";
import { AuthContext } from "../../context/auth-context.decorator";
import { RequirePermission } from "../../auth/permissions.decorator";
import { RateLimit } from "../../rate-limit/rate-limit.decorator";
import { AuthContextData } from "../../context/auth-context.interface";
import { ModelVersionService } from "./model-version.service";

@Controller("models/versions")
@UseGuards(AuthContextGuard, SubscriptionGuard, PermissionsGuard, RateLimitGuard)
export class ModelVersionController {
  constructor(private readonly versionService: ModelVersionService) {}

  /**
   * POST /models/versions/:modelId
   * Create a new version from current model config
   */
  @Post(":modelId")
  @RequirePermission("workspace.models")
  @RateLimit("models.versions.create", 60)
  async createVersion(
    @AuthContext() ctx: AuthContextData,
    @Param("modelId") modelId: string,
    @Body() body: { label?: string }
  ) {
    const version = await this.versionService.createVersionFromModel(
      ctx,
      modelId,
      body.label
    );

    return {
      success: true,
      version,
    };
  }

  /**
   * GET /models/versions/:modelId
   * List all versions for a model
   */
  @Get(":modelId")
  @RequirePermission("workspace.models")
  @RateLimit("models.versions.list", 60)
  async listVersions(
    @AuthContext() ctx: AuthContextData,
    @Param("modelId") modelId: string
  ) {
    const versions = await this.versionService.listVersions(ctx, modelId);

    return {
      success: true,
      versions,
    };
  }

  /**
   * GET /models/versions/id/:versionId
   * Get a single version by ID
   */
  @Get("id/:versionId")
  @RequirePermission("workspace.models")
  @RateLimit("models.versions.get", 60)
  async getVersion(
    @AuthContext() ctx: AuthContextData,
    @Param("versionId") versionId: string
  ) {
    const version = await this.versionService.getVersion(ctx, versionId);

    return {
      success: true,
      version,
    };
  }
}
