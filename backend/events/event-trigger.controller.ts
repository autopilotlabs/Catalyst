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
import { AuthContext } from "../context/auth-context.decorator";
import { AuthContextGuard } from "../context/auth-context.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { SearchIndexService } from "../search/search-index.service";
import { AuthContextData } from "../context/auth-context.interface";
import { PrismaService } from "../prisma/prisma.service";

@Controller("events/triggers")
@UseGuards(AuthContextGuard, PermissionsGuard)
export class EventTriggerController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchIndex: SearchIndexService
  ) {}

  @Get()
  @RequirePermission("workspace.triggers")
  async list(@AuthContext() ctx: AuthContextData) {
    return this.prisma.eventTrigger.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
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
  @RequirePermission("workspace.triggers")
  async get(@Param("id") id: string, @AuthContext() ctx: AuthContextData) {
    const trigger = await this.prisma.eventTrigger.findFirst({
      where: {
        id,
        workspaceId: ctx.workspaceId,
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
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

    if (!trigger) {
      throw new ForbiddenException("Event trigger not found or access denied");
    }

    return trigger;
  }

  @Post()
  @RequirePermission("workspace.triggers")
  async create(@AuthContext() ctx: AuthContextData, @Body() data: any) {
    // Validate that the agent exists and belongs to the workspace
    const agent = await this.prisma.agentConfig.findFirst({
      where: {
        id: data.agentId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!agent) {
      throw new ForbiddenException(
        "Agent not found or does not belong to this workspace"
      );
    }

    // Validate required fields
    if (!data.name || !data.eventType || !data.agentId) {
      throw new ForbiddenException(
        "Missing required fields: name, eventType, agentId"
      );
    }

    const trigger = await this.prisma.eventTrigger.create({
      data: {
        name: data.name,
        description: data.description,
        eventType: data.eventType,
        filter: data.filter || null,
        agentId: data.agentId,
        inputTemplate: data.inputTemplate || {},
        enabled: data.enabled ?? true,
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    // Index for search
    const content = `${trigger.name}\n${trigger.description || ''}\n${trigger.eventType}\n${JSON.stringify(trigger.filter || {})}`;
    await this.searchIndex.indexEntity(ctx.workspaceId, 'trigger', trigger.id, content);

    return trigger;
  }

  @Patch(":id")
  @RequirePermission("workspace.triggers")
  async update(
    @Param("id") id: string,
    @Body() data: any,
    @AuthContext() ctx: AuthContextData
  ) {
    // Verify ownership
    const existing = await this.prisma.eventTrigger.findFirst({
      where: {
        id,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!existing) {
      throw new ForbiddenException("Event trigger not found or access denied");
    }

    // Validate agent if changed
    if (data.agentId && data.agentId !== existing.agentId) {
      const agent = await this.prisma.agentConfig.findFirst({
        where: {
          id: data.agentId,
          workspaceId: ctx.workspaceId,
        },
      });

      if (!agent) {
        throw new ForbiddenException(
          "Agent not found or does not belong to this workspace"
        );
      }
    }

    const trigger = await this.prisma.eventTrigger.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.eventType && { eventType: data.eventType }),
        ...(data.filter !== undefined && { filter: data.filter }),
        ...(data.agentId && { agentId: data.agentId }),
        ...(data.inputTemplate !== undefined && {
          inputTemplate: data.inputTemplate,
        }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    // Re-index for search
    const content = `${trigger.name}\n${trigger.description || ''}\n${trigger.eventType}\n${JSON.stringify(trigger.filter || {})}`;
    await this.searchIndex.indexEntity(ctx.workspaceId, 'trigger', trigger.id, content);

    return trigger;
  }

  @Delete(":id")
  @RequirePermission("workspace.triggers")
  async delete(@Param("id") id: string, @AuthContext() ctx: AuthContextData) {
    // Verify ownership
    const existing = await this.prisma.eventTrigger.findFirst({
      where: {
        id,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!existing) {
      throw new ForbiddenException("Event trigger not found or access denied");
    }

    await this.prisma.eventTrigger.delete({ where: { id } });

    // Remove from search index
    await this.searchIndex.removeEntity(ctx.workspaceId, 'trigger', id);

    return { success: true, id };
  }
}
