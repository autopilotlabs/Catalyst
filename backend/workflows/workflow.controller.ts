import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WorkflowExecutionService } from "./workflow-execution.service";
import { AuthContextGuard } from "../context/auth-context.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { AuthContext } from "../context/auth-context.decorator";
import { AuthContextData } from "../context/auth-context.interface";

@Controller("workflows")
@UseGuards(AuthContextGuard, PermissionsGuard)
export class WorkflowController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowExecution: WorkflowExecutionService
  ) {}

  @Get()
  @RequirePermission("workspace.workflows")
  async listWorkflows(@AuthContext() ctx: AuthContextData) {
    const workflows = await this.prisma.workflow.findMany({
      where: {
        workspaceId: ctx.workspaceId,
      },
      include: {
        _count: {
          select: { steps: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return workflows;
  }

  @Post()
  @RequirePermission("workspace.workflows")
  async createWorkflow(
    @AuthContext() ctx: AuthContextData,
    @Body() body: any
  ) {
    const { name, description, triggerType } = body;

    if (!name || !triggerType) {
      throw new Error("name and triggerType are required");
    }

    const workflow = await this.prisma.workflow.create({
      data: {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        name,
        description,
        triggerType,
        enabled: true,
      },
      include: {
        steps: true,
      },
    });

    // Index for search
    await this.workflowExecution.indexWorkflow(workflow);

    return workflow;
  }

  @Get(":id")
  @RequirePermission("workspace.workflows")
  async getWorkflow(
    @AuthContext() ctx: AuthContextData,
    @Param("id") id: string
  ) {
    const workflow = await this.prisma.workflow.findFirst({
      where: {
        id,
        workspaceId: ctx.workspaceId,
      },
      include: {
        steps: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!workflow) {
      throw new Error("Workflow not found");
    }

    return workflow;
  }

  @Patch(":id")
  @RequirePermission("workspace.workflows")
  async updateWorkflow(
    @AuthContext() ctx: AuthContextData,
    @Param("id") id: string,
    @Body() body: any
  ) {
    // Verify ownership
    const existing = await this.prisma.workflow.findFirst({
      where: {
        id,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!existing) {
      throw new Error("Workflow not found");
    }

    const { name, description, triggerType, enabled } = body;

    const workflow = await this.prisma.workflow.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(triggerType && { triggerType }),
        ...(enabled !== undefined && { enabled }),
      },
      include: {
        steps: true,
      },
    });

    // Re-index for search
    await this.workflowExecution.indexWorkflow(workflow);

    return workflow;
  }

  @Delete(":id")
  @RequirePermission("workspace.workflows")
  async deleteWorkflow(
    @AuthContext() ctx: AuthContextData,
    @Param("id") id: string
  ) {
    // Verify ownership
    const existing = await this.prisma.workflow.findFirst({
      where: {
        id,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!existing) {
      throw new Error("Workflow not found");
    }

    await this.prisma.workflow.delete({
      where: { id },
    });

    // Remove from search index
    await this.workflowExecution.removeWorkflowFromIndex(ctx.workspaceId, id);

    return { success: true };
  }

  @Get(":id/steps")
  @RequirePermission("workspace.workflows")
  async listSteps(
    @AuthContext() ctx: AuthContextData,
    @Param("id") workflowId: string
  ) {
    // Verify workflow ownership
    const workflow = await this.prisma.workflow.findFirst({
      where: {
        id: workflowId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!workflow) {
      throw new Error("Workflow not found");
    }

    const steps = await this.prisma.workflowStep.findMany({
      where: { workflowId },
      orderBy: { order: "asc" },
    });

    return steps;
  }

  @Post(":id/steps")
  @RequirePermission("workspace.workflows")
  async createStep(
    @AuthContext() ctx: AuthContextData,
    @Param("id") workflowId: string,
    @Body() body: any
  ) {
    // Verify workflow ownership
    const workflow = await this.prisma.workflow.findFirst({
      where: {
        id: workflowId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!workflow) {
      throw new Error("Workflow not found");
    }

    const { type, config, position, order } = body;

    // Validate node type
    const validTypes = ["start", "agent", "condition", "delay", "end"];
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid node type: ${type}`);
    }

    // Validate config format
    this.validateStepConfig(type, config);

    // Check max nodes limit
    const stepCount = await this.prisma.workflowStep.count({
      where: { workflowId },
    });

    if (stepCount >= 25) {
      throw new Error("Workflow cannot exceed 25 nodes");
    }

    const step = await this.prisma.workflowStep.create({
      data: {
        workflowId,
        type,
        config: config || {},
        position: position || { x: 0, y: 0 },
        order: order !== undefined ? order : stepCount,
      },
    });

    return step;
  }

  @Patch(":id/steps/:stepId")
  async updateStep(
    @AuthContext() ctx: AuthContextData,
    @Param("id") workflowId: string,
    @Param("stepId") stepId: string,
    @Body() body: any
  ) {
    // Verify workflow ownership
    const workflow = await this.prisma.workflow.findFirst({
      where: {
        id: workflowId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!workflow) {
      throw new Error("Workflow not found");
    }

    const { type, config, position, order } = body;

    // Validate node type if provided
    if (type) {
      const validTypes = ["start", "agent", "condition", "delay", "end"];
      if (!validTypes.includes(type)) {
        throw new Error(`Invalid node type: ${type}`);
      }
    }

    // Validate config if provided
    if (config && type) {
      this.validateStepConfig(type, config);
    }

    const step = await this.prisma.workflowStep.update({
      where: { id: stepId },
      data: {
        ...(type && { type }),
        ...(config && { config }),
        ...(position && { position }),
        ...(order !== undefined && { order }),
      },
    });

    return step;
  }

  @Delete(":id/steps/:stepId")
  @RequirePermission("workspace.workflows")
  async deleteStep(
    @AuthContext() ctx: AuthContextData,
    @Param("id") workflowId: string,
    @Param("stepId") stepId: string
  ) {
    // Verify workflow ownership
    const workflow = await this.prisma.workflow.findFirst({
      where: {
        id: workflowId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!workflow) {
      throw new Error("Workflow not found");
    }

    await this.prisma.workflowStep.delete({
      where: { id: stepId },
    });

    return { success: true };
  }

  private validateStepConfig(type: string, config: any) {
    switch (type) {
      case "agent":
        if (!config.agentId) {
          throw new Error("Agent node requires agentId in config");
        }
        break;

      case "condition":
        if (!config.condition || typeof config.condition !== "string") {
          throw new Error("Condition node requires condition string in config");
        }
        break;

      case "delay":
        if (
          !config.ms ||
          typeof config.ms !== "number" ||
          config.ms < 0 ||
          config.ms > 5 * 60 * 1000
        ) {
          throw new Error(
            "Delay node requires ms number in config (max 5 minutes)"
          );
        }
        break;

      case "start":
      case "end":
        // No required config
        break;

      default:
        throw new Error(`Unknown node type: ${type}`);
    }
  }
}
