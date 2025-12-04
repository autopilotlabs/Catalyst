import { Controller, Post, Get, Body, Param, UseGuards } from "@nestjs/common";
import { AuthContextGuard } from "../../context/auth-context.guard";
import { SubscriptionGuard } from "../../guards/subscription.guard";
import { PermissionsGuard } from "../../guards/permissions.guard";
import { RateLimitGuard } from "../../guards/rate-limit.guard";
import { AuthContext } from "../../context/auth-context.decorator";
import { RequirePermission } from "../../auth/permissions.decorator";
import { RateLimit } from "../../rate-limit/rate-limit.decorator";
import { AuthContextData } from "../../context/auth-context.interface";
import { ModelDeploymentService } from "./model-deployment.service";

@Controller("models/deployments")
@UseGuards(AuthContextGuard, SubscriptionGuard, PermissionsGuard, RateLimitGuard)
export class ModelDeploymentController {
  constructor(private readonly deploymentService: ModelDeploymentService) {}

  /**
   * POST /models/deployments
   * Create a new deployment
   */
  @Post()
  @RequirePermission("workspace.models")
  @RateLimit("models.deployments.create", 60)
  async createDeployment(
    @AuthContext() ctx: AuthContextData,
    @Body() body: {
      modelId: string;
      versionId: string;
      environment: 'dev' | 'staging' | 'prod';
      alias?: string;
    }
  ) {
    const deployment = await this.deploymentService.createDeployment(
      ctx,
      body.modelId,
      body.versionId,
      body.environment,
      body.alias
    );

    return {
      success: true,
      deployment,
    };
  }

  /**
   * GET /models/deployments/:modelId
   * List all deployments for a model
   */
  @Get(":modelId")
  @RequirePermission("workspace.models")
  @RateLimit("models.deployments.list", 60)
  async listDeployments(
    @AuthContext() ctx: AuthContextData,
    @Param("modelId") modelId: string
  ) {
    const deployments = await this.deploymentService.listDeployments(ctx, modelId);

    return {
      success: true,
      deployments,
    };
  }

  /**
   * POST /models/deployments/promote
   * Promote a deployment to a higher environment
   */
  @Post("promote")
  @RequirePermission("workspace.models")
  @RateLimit("models.deployments.promote", 60)
  async promoteDeployment(
    @AuthContext() ctx: AuthContextData,
    @Body() body: {
      fromDeploymentId: string;
      targetEnvironment: 'staging' | 'prod';
    }
  ) {
    const deployment = await this.deploymentService.promoteDeployment(
      ctx,
      body.fromDeploymentId,
      body.targetEnvironment
    );

    return {
      success: true,
      deployment,
    };
  }

  /**
   * POST /models/deployments/rollback
   * Rollback a deployment to a previous version
   */
  @Post("rollback")
  @RequirePermission("workspace.models")
  @RateLimit("models.deployments.rollback", 60)
  async rollbackDeployment(
    @AuthContext() ctx: AuthContextData,
    @Body() body: {
      modelId: string;
      environment: 'staging' | 'prod';
      targetVersionId: string;
    }
  ) {
    const deployment = await this.deploymentService.rollbackDeployment(
      ctx,
      body.modelId,
      body.environment,
      body.targetVersionId
    );

    return {
      success: true,
      deployment,
    };
  }
}
