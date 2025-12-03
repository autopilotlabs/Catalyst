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
import { AuthContextData } from "../context/auth-context.interface";
import { PrismaService } from "../prisma/prisma.service";

@Controller("scheduler")
@UseGuards(AuthContextGuard, PermissionsGuard)
@RequirePermission("workspace.agents")
export class SchedulerController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@AuthContext() ctx: AuthContextData) {
    return this.prisma.scheduledRun.findMany({
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
  async get(@Param("id") id: string, @AuthContext() ctx: AuthContextData) {
    const schedule = await this.prisma.scheduledRun.findFirst({
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

    if (!schedule) {
      throw new ForbiddenException("Schedule not found or access denied");
    }

    return schedule;
  }

  @Post()
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

    // Validate schedule format
    if (!data.schedule || !data.schedule.match(/^\*\/\d+ \* \* \* \*$/)) {
      throw new ForbiddenException(
        'Invalid schedule format. Expected "*/X * * * *" (every X minutes)'
      );
    }

    return this.prisma.scheduledRun.create({
      data: {
        agentId: data.agentId,
        schedule: data.schedule,
        input: data.input || {},
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
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() data: any,
    @AuthContext() ctx: AuthContextData
  ) {
    // Verify ownership
    const existing = await this.prisma.scheduledRun.findFirst({
      where: {
        id,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!existing) {
      throw new ForbiddenException("Schedule not found or access denied");
    }

    // Validate schedule format if provided
    if (data.schedule && !data.schedule.match(/^\*\/\d+ \* \* \* \*$/)) {
      throw new ForbiddenException(
        'Invalid schedule format. Expected "*/X * * * *" (every X minutes)'
      );
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

    return this.prisma.scheduledRun.update({
      where: { id },
      data: {
        ...(data.schedule && { schedule: data.schedule }),
        ...(data.input !== undefined && { input: data.input }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(data.agentId && { agentId: data.agentId }),
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
  }

  @Delete(":id")
  async delete(@Param("id") id: string, @AuthContext() ctx: AuthContextData) {
    // Verify ownership
    const existing = await this.prisma.scheduledRun.findFirst({
      where: {
        id,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!existing) {
      throw new ForbiddenException("Schedule not found or access denied");
    }

    await this.prisma.scheduledRun.delete({ where: { id } });

    return { success: true, id };
  }
}
