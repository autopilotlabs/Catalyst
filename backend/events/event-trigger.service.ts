import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AgentExecutionService } from "../agent/agent-execution.service";
import { SearchIndexService } from "../search/search-index.service";
import { AuthContextData } from "../context/auth-context.interface";
import { EventPayload } from "./event-bus.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class EventTriggerService {
  private readonly logger = new Logger(EventTriggerService.name);
  private workflowExecutionService: any = null;
  private analyticsService: any = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: AgentExecutionService,
    private readonly auditService: AuditService,
    private readonly searchIndex: SearchIndexService
  ) {
    // Lazy load services to avoid circular dependency
    this.initWorkflowService();
    this.initAnalyticsService();
  }

  private async initWorkflowService() {
    try {
      const { WorkflowExecutionService } = await import(
        "../workflows/workflow-execution.service"
      );
      // Store the class for later instantiation
      this.workflowExecutionService = WorkflowExecutionService;
    } catch (error) {
      this.logger.warn("WorkflowExecutionService not available yet");
    }
  }

  private async initAnalyticsService() {
    try {
      const { AnalyticsService } = await import("../analytics/analytics.service");
      this.analyticsService = AnalyticsService;
    } catch (error) {
      // Analytics not available yet
    }
  }

  async handleIncomingEvent(event: EventPayload) {
    const { workspaceId, type, data } = event;

    this.logger.log(`Handling event: ${type} for workspace: ${workspaceId}`);

    // Record analytics for event received
    await this.recordEventAnalytics(workspaceId, type, data);

    // Audit log for event received
    await this.auditService.logEventTrigger(
      { userId: "system", workspaceId, role: "system" } as AuthContextData,
      {
        action: "event.received",
        entityType: "event",
        entityId: type,
        metadata: { payload: data },
      }
    );

    try {
      // Find all matching triggers
      const triggers = await this.prisma.eventTrigger.findMany({
        where: {
          workspaceId,
          enabled: true,
          eventType: type,
        },
        include: {
          agent: true,
        },
      });

      this.logger.log(`Found ${triggers.length} matching triggers for event ${type}`);

      // Process each matching trigger
      for (const trigger of triggers) {
        // Check if event matches filter
        if (!this.matchesFilter(trigger.filter, data)) {
          this.logger.debug(
            `Trigger ${trigger.id} filter didn't match, skipping`
          );
          continue;
        }

        this.logger.log(`Executing trigger: ${trigger.id} (${trigger.name})`);

        // Audit log for trigger fired
        await this.auditService.logEventTrigger(
          { userId: trigger.userId, workspaceId, role: "owner" } as AuthContextData,
          {
            action: "event.trigger.fired",
            entityType: "eventTrigger",
            entityId: trigger.id,
            metadata: {
              eventType: type,
              triggerName: trigger.name,
            },
          }
        );

        // Run trigger in background without blocking
        this.executeTrigger(trigger, data).catch((error) => {
          this.logger.error(
            `Error executing trigger ${trigger.id}: ${error.message}`,
            error.stack
          );
        });
      }

      // ALSO find and execute all matching workflows
      const workflows = await this.prisma.workflow.findMany({
        where: {
          workspaceId,
          enabled: true,
          triggerType: type,
        },
      });

      this.logger.log(`Found ${workflows.length} matching workflows for event ${type}`);

      // Process each matching workflow
      for (const workflow of workflows) {
        this.logger.log(`Executing workflow: ${workflow.id} (${workflow.name})`);

        // Run workflow in background without blocking
        this.executeWorkflow(workflow, data).catch((error) => {
          this.logger.error(
            `Error executing workflow ${workflow.id}: ${error.message}`,
            error.stack
          );
        });
      }
    } catch (error: any) {
      this.logger.error(
        `Error handling event ${type}: ${error.message}`,
        error.stack
      );
    }
  }

  private async executeWorkflow(workflow: any, eventData: any) {
    try {
      // For now, we'll execute workflows by creating a service instance
      // In production, you'd want to use a message queue for better decoupling
      const { WorkflowExecutionService } = await import(
        "../workflows/workflow-execution.service"
      );
      
      const workflowService = new WorkflowExecutionService(
        this.prisma,
        this.executor,
        this.auditService,
        this.searchIndex
      );
      
      await workflowService.executeWorkflow(workflow.id, eventData);
      
      this.logger.log(
        `Successfully executed workflow ${workflow.id} (${workflow.name})`
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to execute workflow ${workflow.id}: ${error.message}`,
        error.stack
      );
    }
  }

  private async recordEventAnalytics(
    workspaceId: string,
    eventType: string,
    payload: any
  ): Promise<void> {
    try {
      if (!this.analyticsService) {
        await this.initAnalyticsService();
      }

      if (this.analyticsService) {
        const analyticsService = new this.analyticsService(this.prisma);
        await analyticsService.recordEvent(
          { userId: "system", workspaceId, role: "owner" },
          "event.received",
          { eventType, payload }
        );
      }
    } catch (error) {
      // Silently fail analytics recording
    }
  }

  private async executeTrigger(trigger: any, eventData: any) {
    try {
      // Merge input template with event data
      const input = this.mergeInput(trigger.inputTemplate, eventData);

      // Create auth context for trigger execution
      const ctx: AuthContextData = {
        userId: trigger.userId,
        workspaceId: trigger.workspaceId,
        role: "owner", // System triggers run as owner
      };

      // Create agent run
      const run = await this.prisma.agentRun.create({
        data: {
          userId: trigger.userId,
          workspaceId: trigger.workspaceId,
          agentId: trigger.agentId,
          input,
          status: "pending",
        },
      });

      this.logger.log(
        `Created agent run ${run.id} for trigger ${trigger.id}`
      );

      // Execute the agent run
      await this.executor.multiStepRun(ctx, run.id);

      this.logger.log(
        `Successfully completed agent run ${run.id} for trigger ${trigger.id}`
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to execute trigger ${trigger.id}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  private matchesFilter(filter: any, data: any): boolean {
    // No filter means match all events
    if (!filter || Object.keys(filter).length === 0) {
      return true;
    }

    try {
      // Check if all filter key-value pairs match the event data
      for (const key of Object.keys(filter)) {
        const filterValue = filter[key];
        const dataValue = this.getNestedValue(data, key);

        if (dataValue !== filterValue) {
          return false;
        }
      }
      return true;
    } catch (error) {
      this.logger.warn(`Error matching filter: ${error}`);
      return false;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    // Support dot notation for nested properties (e.g., "user.id")
    const keys = path.split(".");
    let value = obj;

    for (const key of keys) {
      if (value && typeof value === "object" && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private mergeInput(template: any, eventData: any): any {
    // Merge template with event data
    return {
      ...template,
      event: eventData,
    };
  }
}
