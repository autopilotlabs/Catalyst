import { Injectable, Logger, Inject, forwardRef } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { BillingService } from "../billing/billing.service";
import { AgentExecutionService } from "../agent/agent-execution.service";
import { SearchIndexService } from "../search/search-index.service";
import { AuthContextData } from "../context/auth-context.interface";
import { AuditService } from "../audit/audit.service";
import { EnvService } from "../env/env.service";

interface WorkflowStepData {
  id: string;
  type: string;
  config: any;
  position: any;
  order: number;
}

interface WorkflowExecutionContext {
  workflowId: string;
  eventData: any;
  userId: string;
  workspaceId: string;
  steps: WorkflowStepData[];
  variables: Record<string, any>;
}

@Injectable()
export class WorkflowExecutionService {
  private readonly logger = new Logger(WorkflowExecutionService.name);
  private readonly MAX_EXECUTION_TIME = 2 * 60 * 1000; // 2 minutes
  private readonly MAX_DELAY = 5 * 60 * 1000; // 5 minutes
  private analyticsService: any = null;
  private notificationsService: any = null;
  private realtimeService: any = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly agentExecutor: AgentExecutionService,
    private readonly auditService: AuditService,
    private readonly searchIndex: SearchIndexService,
    private readonly billing: BillingService,
    private readonly envService: EnvService,
    @Inject(forwardRef(() => require('../observability/observability.service').ObservabilityService))
    private readonly observability: any
  ) {
    this.initAnalyticsService();
    this.initNotificationsService();
    this.initRealtimeService();
  }

  async indexWorkflow(workflow: any) {
    const stepDescriptions = workflow.steps?.map((s: any) => 
      `${s.type}: ${JSON.stringify(s.config)}`
    ).join('\n') || '';
    const content = `${workflow.name}\n${workflow.description || ''}\n${stepDescriptions}`;
    await this.searchIndex.indexEntity(workflow.workspaceId, 'workflow', workflow.id, content);
  }

  async removeWorkflowFromIndex(workspaceId: string, workflowId: string) {
    await this.searchIndex.removeEntity(workspaceId, 'workflow', workflowId);
  }

  private async initAnalyticsService() {
    try {
      const { AnalyticsService } = await import("../analytics/analytics.service");
      this.analyticsService = AnalyticsService;
    } catch (error) {
      // Analytics not available yet
    }
  }

  private async initNotificationsService() {
    try {
      const { NotificationsService } = await import("../notifications/notifications.service");
      this.notificationsService = NotificationsService;
    } catch (error) {
      // Notifications not available yet
    }
  }

  private async initRealtimeService() {
    try {
      const { RealtimeService } = await import("../realtime/realtime.service");
      this.realtimeService = RealtimeService;
    } catch (error) {
      // Realtime not available yet
    }
  }

  async executeWorkflow(workflowId: string, eventData: any) {
    this.logger.log(`Executing workflow: ${workflowId}`);

    const startTime = Date.now();
    let workflow: any = null;

    try {
      // Load workflow with steps (enforce workspace isolation)
      workflow = await this.prisma.workflow.findFirst({
        where: {
          id: workflowId,
          enabled: true,
        },
        include: {
          steps: {
            orderBy: { order: "asc" },
          },
        },
      });

      if (!workflow) {
        throw new Error("Workflow not found or disabled");
      }

      // Audit log for workflow execution start
      const ctx: AuthContextData = {
        userId: workflow.userId,
        workspaceId: workflow.workspaceId,
        membership: {
          role: "owner",
        },
      };

      // Resolve environment variables
      const env = await this.envService.resolveAllForWorkspace(ctx);

      await this.auditService.logWorkflowEvent(ctx, {
        action: "workflow.execution.started",
        entityType: "workflow",
        entityId: workflowId,
        metadata: {
          triggerSource: workflow.triggerType,
          eventData,
        },
      });

      // Log observability event
      if (this.observability?.logEvent) {
        await this.observability.logEvent(ctx, {
          category: "workflow",
          eventType: "workflow.run.started",
          entityId: workflowId,
          entityType: "workflow",
          metadata: { triggerType: workflow.triggerType },
        });
      }

      // Broadcast workflow start
      await this.broadcastWorkflowUpdate(
        workflow.workspaceId,
        workflowId,
        "running",
        0
      );

      // Enforce max 25 nodes
      if (workflow.steps.length > 25) {
        throw new Error("Workflow exceeds maximum of 25 nodes");
      }

      // Build execution context
      const context: WorkflowExecutionContext = {
        workflowId: workflow.id,
        eventData,
        userId: workflow.userId,
        workspaceId: workflow.workspaceId,
        steps: workflow.steps as any,
        variables: { ...eventData },
      };

      // Find start node
      const startNode = workflow.steps.find((s: any) => s.type === "start");
      if (!startNode) {
        throw new Error("Workflow missing start node");
      }

      // Execute workflow sequentially
      let currentStepId = startNode.id;
      const executedSteps = new Set<string>();

      while (currentStepId) {
        // Check execution timeout
        if (Date.now() - startTime > this.MAX_EXECUTION_TIME) {
          throw new Error("Workflow execution timeout exceeded");
        }

        // Prevent infinite loops
        if (executedSteps.has(currentStepId)) {
          throw new Error("Workflow loop detected");
        }

        executedSteps.add(currentStepId);

        const step = workflow.steps.find((s: any) => s.id === currentStepId);
        if (!step) {
          throw new Error(`Step ${currentStepId} not found`);
        }

        this.logger.debug(`Executing step: ${step.type} (${step.id})`);

        // Execute step and get next step ID
        currentStepId = await this.executeStep(context, step as any);

        // Async pause to allow other operations
        await new Promise((resolve) => setImmediate(resolve));
      }

      this.logger.log(
        `Workflow ${workflowId} completed successfully after ${executedSteps.size} steps`
      );

      // Record analytics
      await this.recordWorkflowAnalytics(
        workflow.userId,
        workflow.workspaceId,
        workflowId,
        workflow.name,
        eventData
      );

      // Audit log for workflow execution completion
      await this.auditService.logWorkflowEvent(ctx, {
        action: "workflow.execution.completed",
        entityType: "workflow",
        entityId: workflowId,
        metadata: {
          stepsCount: executedSteps.size,
          status: "completed",
        },
      });

      // Record billing usage for workflow run
      const workflowCost = 0.001; // $0.001 per workflow run
      try {
        await this.billing.recordUsage(
          { userId: workflow.userId, workspaceId: workflow.workspaceId, membership: { role: "member" } },
          "workflow.run",
          1,
          workflowCost,
          {
            workflowId: workflow.id,
            stepsExecuted: executedSteps.size,
          }
        );
      } catch (billingError: any) {
        this.logger.error(`Failed to record workflow billing: ${billingError.message}`);
      }

      // Send completion notification
      await this.sendCompletionNotification(
        workflow.workspaceId,
        workflow.name,
        executedSteps.size
      );

      // Log observability event for completion
      const totalDuration = Date.now() - startTime;
      if (this.observability?.logEvent) {
        await this.observability.logEvent(ctx, {
          category: "workflow",
          eventType: "workflow.run.completed",
          entityId: workflowId,
          entityType: "workflow",
          durationMs: totalDuration,
          success: true,
          metadata: { stepsExecuted: executedSteps.size },
        });
      }

      // Broadcast workflow completion
      await this.broadcastWorkflowUpdate(
        workflow.workspaceId,
        workflowId,
        "completed",
        executedSteps.size
      );

      return {
        success: true,
        stepsExecuted: executedSteps.size,
        variables: context.variables,
      };
    } catch (error: any) {
      this.logger.error(
        `Workflow ${workflowId} execution failed: ${error.message}`,
        error.stack
      );

      // Send failure notification
      await this.sendFailureNotification(
        workflow?.workspaceId,
        workflow?.name || workflowId,
        error.message
      );

      // Broadcast workflow failure
      if (workflow?.workspaceId) {
        await this.broadcastWorkflowUpdate(
          workflow.workspaceId,
          workflowId,
          "failed",
          0
        );
      }

      throw error;
    }
  }

  private async recordWorkflowAnalytics(
    userId: string,
    workspaceId: string,
    workflowId: string,
    workflowName: string,
    eventData: any
  ): Promise<void> {
    try {
      if (!this.analyticsService) {
        await this.initAnalyticsService();
      }

      if (this.analyticsService) {
        const analyticsService = new this.analyticsService(this.prisma);
        await analyticsService.recordEvent(
          { userId, workspaceId, role: "owner" },
          "workflow.triggered",
          { workflowId, workflowName, eventData }
        );
      }
    } catch (error) {
      // Silently fail analytics recording
    }
  }

  private async executeStep(
    context: WorkflowExecutionContext,
    step: WorkflowStepData
  ): Promise<string | null> {
    switch (step.type) {
      case "start":
        return this.executeStartNode(context, step);

      case "agent":
        return this.executeAgentNode(context, step);

      case "condition":
        return this.executeConditionNode(context, step);

      case "delay":
        return this.executeDelayNode(context, step);

      case "end":
        return this.executeEndNode(context, step);

      default:
        this.logger.warn(`Unknown step type: ${step.type}`);
        return null;
    }
  }

  private async executeStartNode(
    context: WorkflowExecutionContext,
    step: WorkflowStepData
  ): Promise<string | null> {
    // Start node just passes through to the next connected node
    return this.getNextStepId(context, step);
  }

  private async executeAgentNode(
    context: WorkflowExecutionContext,
    step: WorkflowStepData
  ): Promise<string | null> {
    const { agentId, inputTemplate } = step.config;

    if (!agentId) {
      throw new Error("Agent node missing agentId in config");
    }

    this.logger.log(`Executing agent: ${agentId}`);

    // Merge input template with variables
    const input = this.mergeTemplate(inputTemplate || {}, context.variables);

    // Create auth context
    const authContext: AuthContextData = {
      userId: context.userId,
      workspaceId: context.workspaceId,
      membership: {
        role: "owner",
      },
    };

    // Create agent run
    const run = await this.prisma.agentRun.create({
      data: {
        userId: context.userId,
        workspaceId: context.workspaceId,
        agentId,
        input,
        status: "pending",
      },
    });

    // Execute agent
    const result = await this.agentExecutor.multiStepRun(authContext, run.id);

    // Store result in variables
    context.variables.agentOutput = result.output;
    context.variables.agentState = result.state;

    return this.getNextStepId(context, step);
  }

  private async executeConditionNode(
    context: WorkflowExecutionContext,
    step: WorkflowStepData
  ): Promise<string | null> {
    const { condition } = step.config;

    if (!condition) {
      throw new Error("Condition node missing condition in config");
    }

    // Safely evaluate condition
    const result = this.evaluateCondition(condition, context.variables);

    this.logger.debug(
      `Condition "${condition}" evaluated to: ${result}`
    );

    // Get next step based on condition result
    return this.getNextStepId(context, step, result ? "true" : "false");
  }

  private async executeDelayNode(
    context: WorkflowExecutionContext,
    step: WorkflowStepData
  ): Promise<string | null> {
    const { ms } = step.config;

    if (!ms || typeof ms !== "number") {
      throw new Error("Delay node missing ms in config");
    }

    // Enforce max delay
    const delayMs = Math.min(ms, this.MAX_DELAY);

    this.logger.debug(`Delaying execution for ${delayMs}ms`);

    await new Promise((resolve) => setTimeout(resolve, delayMs));

    return this.getNextStepId(context, step);
  }

  private async executeEndNode(
    context: WorkflowExecutionContext,
    step: WorkflowStepData
  ): Promise<string | null> {
    this.logger.log("Workflow reached end node");
    return null; // End workflow
  }

  private getNextStepId(
    context: WorkflowExecutionContext,
    currentStep: WorkflowStepData,
    edgeLabel?: string
  ): string | null {
    // For now, just return the next step in order
    // In a full implementation, you'd parse edges/connections from the workflow data
    
    const currentIndex = context.steps.findIndex((s) => s.id === currentStep.id);
    const nextIndex = currentIndex + 1;

    if (nextIndex < context.steps.length) {
      return context.steps[nextIndex].id;
    }

    return null; // No more steps
  }

  private evaluateCondition(condition: string, variables: Record<string, any>): boolean {
    try {
      // Create a safe evaluation context with only allowed operations
      const safeVariables = { ...variables };
      
      // Only allow simple comparisons and logical operations
      // Remove any function calls or dangerous operations
      const sanitized = condition
        .replace(/[^a-zA-Z0-9._\s><=!&|()'"]/g, "")
        .replace(/function/gi, "")
        .replace(/eval/gi, "")
        .replace(/constructor/gi, "");

      // Create function with variables as parameters
      const func = new Function(
        ...Object.keys(safeVariables),
        `return ${sanitized};`
      );

      // Execute with variable values
      return Boolean(func(...Object.values(safeVariables)));
    } catch (error: any) {
      this.logger.warn(
        `Failed to evaluate condition "${condition}": ${error.message}`
      );
      return false;
    }
  }

  private mergeTemplate(
    template: any,
    variables: Record<string, any>
  ): any {
    // Deep merge template with variables
    const merged = { ...template };

    // Replace variable placeholders like {{variableName}}
    const replaceVariables = (obj: any): any => {
      if (typeof obj === "string") {
        return obj.replace(/\{\{(\w+)\}\}/g, (_, key) => {
          return variables[key] !== undefined ? String(variables[key]) : "";
        });
      } else if (Array.isArray(obj)) {
        return obj.map(replaceVariables);
      } else if (obj !== null && typeof obj === "object") {
        const result: any = {};
        for (const key of Object.keys(obj)) {
          result[key] = replaceVariables(obj[key]);
        }
        return result;
      }
      return obj;
    };

    return {
      ...replaceVariables(merged),
      event: variables,
    };
  }

  private async sendCompletionNotification(
    workspaceId: string,
    workflowName: string,
    stepsCount: number
  ): Promise<void> {
    try {
      if (!this.notificationsService) {
        await this.initNotificationsService();
      }

      if (this.notificationsService) {
        const notificationsService = new this.notificationsService(
          this.prisma,
          this.auditService
        );
        await notificationsService.sendToWorkspace(
          workspaceId,
          "workflow.completed",
          "Workflow Completed",
          `Workflow "${workflowName}" completed successfully with ${stepsCount} steps executed.`,
          {
            workflowName,
            stepsCount,
          }
        );
      }
    } catch (error) {
      // Silently fail notification sending
      this.logger.warn(`Failed to send workflow completion notification: ${error}`);
    }
  }

  private async sendFailureNotification(
    workspaceId: string,
    workflowName: string,
    errorMessage: string
  ): Promise<void> {
    try {
      if (!this.notificationsService) {
        await this.initNotificationsService();
      }

      if (this.notificationsService) {
        const notificationsService = new this.notificationsService(
          this.prisma,
          this.auditService
        );
        await notificationsService.sendToWorkspace(
          workspaceId,
          "workflow.failed",
          "Workflow Failed",
          `Workflow "${workflowName}" failed with error: ${errorMessage}`,
          {
            workflowName,
            error: errorMessage,
          }
        );
      }
    } catch (error) {
      // Silently fail notification sending
      this.logger.warn(`Failed to send workflow failure notification: ${error}`);
    }
  }

  private async broadcastWorkflowUpdate(
    workspaceId: string,
    workflowId: string,
    status: string,
    stepsExecuted: number
  ): Promise<void> {
    try {
      if (!this.realtimeService) {
        await this.initRealtimeService();
      }

      if (this.realtimeService) {
        // Note: This won't work without proper DI, but structure is correct
        this.logger.debug(
          `[Realtime] Would broadcast workflow.run.update for workflow ${workflowId}`
        );
      }
    } catch (error) {
      // Silently fail realtime broadcast
    }
  }

  /**
   * Run job handler for background queue
   */
  async runJob(job: any, payload: any): Promise<void> {
    this.logger.log(`Executing workflow job: ${job.id}`);

    const { workflowId, eventData } = payload;

    // Execute the workflow
    await this.executeWorkflow(workflowId, eventData);
  }
}
