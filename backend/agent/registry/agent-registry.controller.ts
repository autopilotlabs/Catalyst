import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from "@nestjs/common";
import { AuthContext } from "../../context/auth-context.decorator";
import { AuthContextGuard } from "../../context/auth-context.guard";
import { PermissionsGuard } from "../../guards/permissions.guard";
import { RequirePermission } from "../../auth/permissions.decorator";
import { AuthContextData } from "../../context/auth-context.interface";
import { AgentRegistryService } from "./agent-registry.service";

@Controller("agent/config")
@UseGuards(AuthContextGuard, PermissionsGuard)
export class AgentRegistryController {
  constructor(private readonly registry: AgentRegistryService) {}

  @Get()
  @RequirePermission("workspace.agents")
  async list(@AuthContext() ctx: AuthContextData) {
    return this.registry.listAgents(ctx.workspaceId);
  }

  @Get(":id")
  @RequirePermission("workspace.agents")
  async get(@Param("id") id: string, @AuthContext() ctx: AuthContextData) {
    return this.registry.getAgent(id, ctx.workspaceId);
  }

  @Post()
  @RequirePermission("workspace.agents")
  async create(@Body() data: any, @AuthContext() ctx: AuthContextData) {
    return this.registry.createAgent(ctx.workspaceId, data);
  }

  @Patch(":id")
  @RequirePermission("workspace.agents")
  async update(
    @Param("id") id: string,
    @Body() data: any,
    @AuthContext() ctx: AuthContextData
  ) {
    return this.registry.updateAgent(id, ctx.workspaceId, data);
  }

  @Delete(":id")
  @RequirePermission("workspace.agents")
  async delete(@Param("id") id: string, @AuthContext() ctx: AuthContextData) {
    return this.registry.deleteAgent(id, ctx.workspaceId);
  }
}
