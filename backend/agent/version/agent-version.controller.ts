import { Controller, Post, Get, Body, Param, UseGuards } from "@nestjs/common";
import { AuthContextGuard } from "../../context/auth-context.guard";
import { SubscriptionGuard } from "../../guards/subscription.guard";
import { PermissionsGuard } from "../../guards/permissions.guard";
import { RateLimitGuard } from "../../guards/rate-limit.guard";
import { AuthContext } from "../../context/auth-context.decorator";
import { RequirePermission } from "../../auth/permissions.decorator";
import { RateLimit } from "../../rate-limit/rate-limit.decorator";
import { AuthContextData } from "../../context/auth-context.interface";
import { AgentVersionService } from "./agent-version.service";

@Controller("agent/versions")
@UseGuards(AuthContextGuard, SubscriptionGuard, PermissionsGuard, RateLimitGuard)
export class AgentVersionController {
  constructor(private readonly versionService: AgentVersionService) {}

  /**
   * POST /agent/versions/:agentId
   * Create a new version from current agent config
   */
  @Post(":agentId")
  @RequirePermission("workspace.agents")
  @RateLimit("agent.versions.create", 60)
  async createVersion(
    @AuthContext() ctx: AuthContextData,
    @Param("agentId") agentId: string,
    @Body() body: { label?: string }
  ) {
    const version = await this.versionService.createVersionFromAgent(
      ctx,
      agentId,
      body.label
    );

    return {
      success: true,
      version,
    };
  }

  /**
   * GET /agent/versions/:agentId
   * List all versions for an agent
   */
  @Get(":agentId")
  @RequirePermission("workspace.agents")
  @RateLimit("agent.versions.list", 60)
  async listVersions(
    @AuthContext() ctx: AuthContextData,
    @Param("agentId") agentId: string
  ) {
    const versions = await this.versionService.listVersions(ctx, agentId);

    return {
      success: true,
      versions,
    };
  }

  /**
   * GET /agent/versions/id/:versionId
   * Get a single version by ID
   */
  @Get("id/:versionId")
  @RequirePermission("workspace.agents")
  @RateLimit("agent.versions.get", 60)
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
