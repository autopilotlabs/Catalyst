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
import { AuthContext } from "../../context/auth-context.decorator";
import { AuthContextGuard } from "../../context/auth-context.guard";
import { AuthContextData } from "../../context/auth-context.interface";

@Controller("agent/plugins/:pluginId/tools")
export class PluginToolController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(AuthContextGuard)
  @Get()
  async listTools(
    @Param("pluginId") pluginId: string,
    @AuthContext() ctx: AuthContextData
  ) {
    // Verify plugin ownership
    const plugin = await this.prisma.plugin.findFirst({
      where: {
        id: pluginId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!plugin) {
      throw new ForbiddenException("Plugin not found or access denied");
    }

    return this.prisma.pluginTool.findMany({
      where: { pluginId },
      orderBy: { createdAt: "desc" },
    });
  }

  @UseGuards(AuthContextGuard)
  @Get(":toolId")
  async getTool(
    @Param("pluginId") pluginId: string,
    @Param("toolId") toolId: string,
    @AuthContext() ctx: AuthContextData
  ) {
    // Verify plugin ownership
    const plugin = await this.prisma.plugin.findFirst({
      where: {
        id: pluginId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!plugin) {
      throw new ForbiddenException("Plugin not found or access denied");
    }

    const tool = await this.prisma.pluginTool.findFirst({
      where: {
        id: toolId,
        pluginId,
      },
    });

    if (!tool) {
      throw new ForbiddenException("Tool not found");
    }

    return tool;
  }

  @UseGuards(AuthContextGuard)
  @Post()
  async createTool(
    @Param("pluginId") pluginId: string,
    @Body() data: any,
    @AuthContext() ctx: AuthContextData
  ) {
    // Verify plugin ownership
    const plugin = await this.prisma.plugin.findFirst({
      where: {
        id: pluginId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!plugin) {
      throw new ForbiddenException("Plugin not found or access denied");
    }

    // Validate required fields
    if (!data.name || !data.code) {
      throw new ForbiddenException("Tool name and code are required");
    }

    // Validate parameters (should be valid JSON Schema)
    if (data.parameters && typeof data.parameters !== "object") {
      throw new ForbiddenException("Parameters must be a valid JSON object");
    }

    return this.prisma.pluginTool.create({
      data: {
        pluginId,
        name: data.name,
        description: data.description,
        parameters: data.parameters || {},
        code: data.code,
      },
    });
  }

  @UseGuards(AuthContextGuard)
  @Patch(":toolId")
  async updateTool(
    @Param("pluginId") pluginId: string,
    @Param("toolId") toolId: string,
    @Body() data: any,
    @AuthContext() ctx: AuthContextData
  ) {
    // Verify plugin ownership
    const plugin = await this.prisma.plugin.findFirst({
      where: {
        id: pluginId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!plugin) {
      throw new ForbiddenException("Plugin not found or access denied");
    }

    // Verify tool exists
    const tool = await this.prisma.pluginTool.findFirst({
      where: {
        id: toolId,
        pluginId,
      },
    });

    if (!tool) {
      throw new ForbiddenException("Tool not found");
    }

    // Validate parameters if provided
    if (data.parameters && typeof data.parameters !== "object") {
      throw new ForbiddenException("Parameters must be a valid JSON object");
    }

    return this.prisma.pluginTool.update({
      where: { id: toolId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.parameters !== undefined && { parameters: data.parameters }),
        ...(data.code && { code: data.code }),
      },
    });
  }

  @UseGuards(AuthContextGuard)
  @Delete(":toolId")
  async deleteTool(
    @Param("pluginId") pluginId: string,
    @Param("toolId") toolId: string,
    @AuthContext() ctx: AuthContextData
  ) {
    // Verify plugin ownership
    const plugin = await this.prisma.plugin.findFirst({
      where: {
        id: pluginId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!plugin) {
      throw new ForbiddenException("Plugin not found or access denied");
    }

    // Verify tool exists
    const tool = await this.prisma.pluginTool.findFirst({
      where: {
        id: toolId,
        pluginId,
      },
    });

    if (!tool) {
      throw new ForbiddenException("Tool not found");
    }

    await this.prisma.pluginTool.delete({ where: { id: toolId } });

    return { success: true, id: toolId };
  }
}
