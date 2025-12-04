import { Controller, Post, Get, Body, Param, UseGuards } from "@nestjs/common";
import { AuthContextGuard } from "../../context/auth-context.guard";
import { SubscriptionGuard } from "../../guards/subscription.guard";
import { PermissionsGuard } from "../../guards/permissions.guard";
import { RateLimitGuard } from "../../guards/rate-limit.guard";
import { AuthContext } from "../../context/auth-context.decorator";
import { RequirePermission } from "../../auth/permissions.decorator";
import { RateLimit } from "../../rate-limit/rate-limit.decorator";
import { AuthContextData } from "../../context/auth-context.interface";
import { AgentDeploymentService } from "./agent-deployment.service";

@Controller("agent/deployments")
@UseGuards(AuthContextGuard, SubscriptionGuard, PermissionsGuard, RateLimitGuard)
export class AgentDeploymentController {
  constructor(private readonly deploymentService: AgentDeploymentService) {}

  /**
   * POST /agent/deployments
   * Create a new deployment
   */
  @Post()
  @RequirePermission("workspace.agents")
  @RateLimit("agent.deployments.create", 60)
  async createDeployment(
    @AuthContext() ctx: AuthContextData,
    @Body() body: {
      agentId: string;
      versionId: string;
      environment: 'dev' | 'staging' | 'prod';
      alias?: string;
    }
  ) {
    const deployment = await this.deploymentService.createDeployment(
      ctx,
      body.agentId,
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
   * GET /agent/deployments/:agentId
   * List all deployments for an agent
   */
  @Get(":agentId")
  @RequirePermission("workspace.agents")
  @RateLimit("agent.deployments.list", 60)
  async listDeployments(
    @AuthContext() ctx: AuthContextData,
    @Param("agentId") agentId: string
  ) {
    const deployments = await this.deploymentService.listDeployments(ctx, agentId);

    return {
      success: true,
      deployments,
    };
  }

  /**
   * POST /agent/deployments/promote
   * Promote a deployment to a higher environment
   */
  @Post("promote")
  @RequirePermission("workspace.agents")
  @RateLimit("agent.deployments.promote", 60)
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
   * POST /agent/deployments/rollback
   * Rollback a deployment to a previous version
   */
  @Post("rollback")
  @RequirePermission("workspace.agents")
  @RateLimit("agent.deployments.rollback", 60)
  async rollbackDeployment(
    @AuthContext() ctx: AuthContextData,
    @Body() body: {
      agentId: string;
      environment: 'staging' | 'prod';
      targetVersionId: string;
    }
  ) {
    const deployment = await this.deploymentService.rollbackDeployment(
      ctx,
      body.environment,
      body.agentId,
      body.targetVersionId
    );

    return {
      success: true,
      deployment,
    };
  }
}
