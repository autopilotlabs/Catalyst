import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SearchIndexService } from "../../search/search-index.service";
import { AuthContext } from "../../context/auth-context.decorator";
import { AuthContextGuard } from "../../context/auth-context.guard";
import { PermissionsGuard } from "../../guards/permissions.guard";
import { RequirePermission } from "../../auth/permissions.decorator";
import { AuthContextData } from "../../context/auth-context.interface";

@Controller("agent/plugins")
@UseGuards(AuthContextGuard, PermissionsGuard)
@RequirePermission("workspace.agents")
export class PluginController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchIndex: SearchIndexService
  ) {}

  @Get()
  async listPlugins(@AuthContext() ctx: AuthContextData) {
    return this.prisma.plugin.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: {
        tools: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  @Get(":id")
  async getPlugin(@Param("id") id: string, @AuthContext() ctx: AuthContextData) {
    const plugin = await this.prisma.plugin.findFirst({
      where: {
        id,
        workspaceId: ctx.workspaceId,
      },
      include: {
        tools: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!plugin) {
      throw new ForbiddenException("Plugin not found or access denied");
    }

    return plugin;
  }

  @Post()
  async createPlugin(@AuthContext() ctx: AuthContextData, @Body() data: any) {
    // Validate required fields
    if (!data.name) {
      throw new ForbiddenException("Plugin name is required");
    }

    const plugin = await this.prisma.plugin.create({
      data: {
        name: data.name,
        description: data.description,
        enabled: data.enabled ?? true,
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
      },
      include: {
        tools: true,
      },
    });

    // Index for search
    const toolNames = plugin.tools.map((t: any) => t.name).join(', ');
    const content = `${plugin.name}\n${plugin.description || ''}\nTools: ${toolNames}`;
    await this.searchIndex.indexEntity(ctx.workspaceId, 'plugin', plugin.id, content);

    return plugin;
  }

  @UseGuards(AuthContextGuard)
  @Patch(":id")
  async updatePlugin(
    @Param("id") id: string,
    @Body() data: any,
    @AuthContext() ctx: AuthContextData
  ) {
    // Verify ownership
    const existing = await this.prisma.plugin.findFirst({
      where: {
        id,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!existing) {
      throw new ForbiddenException("Plugin not found or access denied");
    }

    return this.prisma.plugin.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
      },
      include: {
        tools: true,
      },
    });
  }

  @Delete(":id")
  async deletePlugin(
    @Param("id") id: string,
    @AuthContext() ctx: AuthContextData
  ) {
    // Verify ownership
    const existing = await this.prisma.plugin.findFirst({
      where: {
        id,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!existing) {
      throw new ForbiddenException("Plugin not found or access denied");
    }

    await this.prisma.plugin.delete({ where: { id } });

    // Remove from search index
    await this.searchIndex.removeEntity(ctx.workspaceId, 'plugin', id);

    return { success: true, id };
  }
}
