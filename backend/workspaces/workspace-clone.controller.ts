import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { WorkspaceCloneService } from "./workspace-clone.service";
import { AuthContext } from "../context/auth-context.decorator";
import { AuthContextGuard } from "../context/auth-context.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { RateLimitGuard } from "../guards/rate-limit.guard";
import { RateLimit } from "../rate-limit/rate-limit.decorator";
import { AuthContextData } from "../context/auth-context.interface";

@Controller()
@UseGuards(AuthContextGuard, PermissionsGuard, RateLimitGuard)
export class WorkspaceCloneController {
  constructor(private readonly cloneService: WorkspaceCloneService) {}

  /**
   * POST /workspaces/:workspaceId/clone
   * Create a clone request for a workspace
   */
  @Post("workspaces/:workspaceId/clone")
  @RequirePermission("workspace.admin")
  @RateLimit("workspace.clone", 10)
  async cloneWorkspace(
    @Param("workspaceId") workspaceId: string,
    @Body("includeMembers") includeMembers: boolean,
    @AuthContext() ctx: AuthContextData
  ) {
    // Validate includeMembers is a boolean
    if (typeof includeMembers !== "boolean") {
      throw new BadRequestException(
        "includeMembers must be a boolean value"
      );
    }

    // Ensure user is admin of source workspace
    if (ctx.workspaceId !== workspaceId) {
      throw new BadRequestException(
        "You can only clone the workspace you are currently accessing"
      );
    }

    const cloneRequest = await this.cloneService.createCloneRequest(
      ctx,
      workspaceId,
      includeMembers
    );

    return {
      id: cloneRequest.id,
      sourceWorkspaceId: cloneRequest.sourceWorkspaceId,
      status: cloneRequest.status,
      includeMembers: cloneRequest.includeMembers,
      createdAt: cloneRequest.createdAt,
    };
  }

  /**
   * GET /workspace-clones
   * List clone requests for current workspace
   */
  @Get("workspace-clones")
  @RequirePermission("workspace.read")
  @RateLimit("workspace-clones.list", 60)
  async listCloneRequests(@AuthContext() ctx: AuthContextData) {
    const clones = await this.cloneService.listCloneRequests(ctx.workspaceId);

    return clones.map((clone) => ({
      id: clone.id,
      sourceWorkspaceId: clone.sourceWorkspaceId,
      targetWorkspaceId: clone.targetWorkspaceId,
      status: clone.status,
      includeMembers: clone.includeMembers,
      error: clone.error,
      createdAt: clone.createdAt,
      updatedAt: clone.updatedAt,
    }));
  }

  /**
   * GET /workspace-clones/:cloneId
   * Get clone request by ID
   */
  @Get("workspace-clones/:cloneId")
  @RequirePermission("workspace.read")
  @RateLimit("workspace-clones.get", 60)
  async getCloneRequest(
    @Param("cloneId") cloneId: string,
    @AuthContext() ctx: AuthContextData
  ) {
    const clone = await this.cloneService.getCloneRequest(
      cloneId,
      ctx.workspaceId
    );

    if (!clone) {
      throw new NotFoundException("Clone request not found");
    }

    return {
      id: clone.id,
      sourceWorkspaceId: clone.sourceWorkspaceId,
      targetWorkspaceId: clone.targetWorkspaceId,
      status: clone.status,
      includeMembers: clone.includeMembers,
      error: clone.error,
      createdAt: clone.createdAt,
      updatedAt: clone.updatedAt,
    };
  }
}
