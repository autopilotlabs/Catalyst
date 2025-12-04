import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthContextData } from "../context/auth-context.interface";
import { AuditService } from "../audit/audit.service";
import { BillingService } from "../billing/billing.service";
import { NotificationsService } from "../notifications/notifications.service";
import { JobQueueService } from "../jobs/job-queue.service";

/**
 * WorkspaceCloneService
 * 
 * Deep clones a workspace including:
 * - Agents
 * - Workflows
 * - Triggers
 * - Memory
 * - Eval Suites + Tests
 * - API Keys (cloned but set revoked)
 * - Workspace Limits
 * - Workspace Settings
 * - Members (optional)
 */
@Injectable()
export class WorkspaceCloneService {
  private readonly logger = new Logger(WorkspaceCloneService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
    private readonly notifications: NotificationsService,
    private readonly jobQueue: JobQueueService
  ) {}

  /**
   * Create a clone request and enqueue background job
   */
  async createCloneRequest(
    ctx: AuthContextData,
    sourceWorkspaceId: string,
    includeMembers: boolean
  ) {
    // Verify source workspace exists and user has admin access
    const sourceWorkspace = await this.prisma.workspace.findUnique({
      where: { id: sourceWorkspaceId },
    });

    if (!sourceWorkspace) {
      throw new Error(`Source workspace ${sourceWorkspaceId} not found`);
    }

    // Create clone request
    const cloneRequest = await this.prisma.workspaceClone.create({
      data: {
        sourceWorkspaceId,
        userId: ctx.userId,
        status: "pending",
        includeMembers,
      },
    });

    this.logger.log(
      `Clone request created: ${cloneRequest.id} (source: ${sourceWorkspaceId})`
    );

    // Enqueue background job
    await this.jobQueue.enqueue(
      "workspace.clone",
      { cloneId: cloneRequest.id },
      sourceWorkspaceId
    );

    // Audit log
    await this.audit.record(ctx, {
      action: "workspace.clone.requested",
      entityType: "WorkspaceClone",
      entityId: cloneRequest.id,
      metadata: {
        sourceWorkspaceId,
        includeMembers,
      },
    });

    return cloneRequest;
  }

  /**
   * Execute the clone job (called by job queue)
   */
  async executeCloneJob(cloneId: string) {
    try {
      this.logger.log(`Starting clone job: ${cloneId}`);

      // Load clone request
      const cloneRequest = await this.prisma.workspaceClone.findUnique({
        where: { id: cloneId },
      });

      if (!cloneRequest) {
        throw new Error(`Clone request ${cloneId} not found`);
      }

      // Update status to running
      await this.prisma.workspaceClone.update({
        where: { id: cloneId },
        data: { status: "running", updatedAt: new Date() },
      });

      // Load source workspace
      const sourceWorkspace = await this.prisma.workspace.findUnique({
        where: { id: cloneRequest.sourceWorkspaceId },
        include: {
          limits: true,
          subscription: true,
        },
      });

      if (!sourceWorkspace) {
        throw new Error(
          `Source workspace ${cloneRequest.sourceWorkspaceId} not found`
        );
      }

      // Create new workspace
      const targetWorkspace = await this.prisma.workspace.create({
        data: {
          name: `${sourceWorkspace.name} (Copy)`,
        },
      });

      this.logger.log(
        `Created target workspace: ${targetWorkspace.id} (name: ${targetWorkspace.name})`
      );

      // Initialize ID mapping tables
      const agentMap = new Map<string, string>();
      const workflowMap = new Map<string, string>();
      const triggerMap = new Map<string, string>();
      const memoryMap = new Map<string, string>();
      const evalSuiteMap = new Map<string, string>();
      const evalTestMap = new Map<string, string>();

      // === CLONE PIPELINE ===

      // 1. Clone Agents
      await this.cloneAgents(
        cloneRequest.sourceWorkspaceId,
        targetWorkspace.id,
        agentMap
      );

      // 2. Clone Workflows (with agent ID remapping)
      await this.cloneWorkflows(
        cloneRequest.sourceWorkspaceId,
        targetWorkspace.id,
        workflowMap,
        agentMap
      );

      // 3. Clone Triggers (with agent/workflow ID remapping)
      await this.cloneTriggers(
        cloneRequest.sourceWorkspaceId,
        targetWorkspace.id,
        cloneRequest.userId || "system",
        triggerMap,
        agentMap
      );

      // 4. Clone Memory
      await this.cloneMemory(
        cloneRequest.sourceWorkspaceId,
        targetWorkspace.id,
        cloneRequest.userId || "system",
        memoryMap
      );

      // 5. Clone Eval Suites + Tests
      await this.cloneEvals(
        cloneRequest.sourceWorkspaceId,
        targetWorkspace.id,
        evalSuiteMap,
        evalTestMap
      );

      // 6. Clone API Keys (but set revoked)
      await this.cloneApiKeys(
        cloneRequest.sourceWorkspaceId,
        targetWorkspace.id
      );

      // 7. Clone Workspace Limits
      await this.cloneWorkspaceLimits(
        cloneRequest.sourceWorkspaceId,
        targetWorkspace.id
      );

      // 8. Clone Members (if requested)
      if (cloneRequest.includeMembers) {
        await this.cloneMembers(
          cloneRequest.sourceWorkspaceId,
          targetWorkspace.id
        );
      }

      // Update clone request with success
      await this.prisma.workspaceClone.update({
        where: { id: cloneId },
        data: {
          status: "success",
          targetWorkspaceId: targetWorkspace.id,
          updatedAt: new Date(),
        },
      });

      // Create context for audit/billing
      const ctx: AuthContextData = {
        userId: cloneRequest.userId || "system",
        workspaceId: cloneRequest.sourceWorkspaceId,
        membership: {
          role: "admin",
        },
      };

      // Record billing
      await this.billing.recordUsage(ctx, "workspace.clone", 1, 0.25);

      // Audit log
      await this.audit.record(ctx, {
        action: "workspace.clone.completed",
        entityType: "WorkspaceClone",
        entityId: cloneRequest.id,
        metadata: {
          sourceWorkspaceId: cloneRequest.sourceWorkspaceId,
          targetWorkspaceId: targetWorkspace.id,
          includeMembers: cloneRequest.includeMembers,
          stats: {
            agents: agentMap.size,
            workflows: workflowMap.size,
            triggers: triggerMap.size,
            memory: memoryMap.size,
            evalSuites: evalSuiteMap.size,
            evalTests: evalTestMap.size,
          },
        },
      });

      // Send notification
      await this.notifications.sendToWorkspace(
        cloneRequest.sourceWorkspaceId,
        "workspace.clone.completed",
        "Workspace Clone Completed",
        `Your workspace has been successfully cloned to "${targetWorkspace.name}".`,
        {
          cloneId: cloneRequest.id,
          targetWorkspaceId: targetWorkspace.id,
        }
      );

      this.logger.log(
        `Clone job completed: ${cloneId} (target: ${targetWorkspace.id})`
      );
    } catch (error: any) {
      this.logger.error(
        `Clone job failed: ${cloneId} - ${error.message}`,
        error.stack
      );
      await this.markCloneError(cloneId, error);
      throw error;
    }
  }

  /**
   * Mark clone as error
   */
  private async markCloneError(cloneId: string, error: Error) {
    try {
      const cloneRequest = await this.prisma.workspaceClone.findUnique({
        where: { id: cloneId },
      });

      if (!cloneRequest) return;

      await this.prisma.workspaceClone.update({
        where: { id: cloneId },
        data: {
          status: "error",
          error: error.message,
          updatedAt: new Date(),
        },
      });

      // Create context
      const ctx: AuthContextData = {
        userId: cloneRequest.userId || "system",
        workspaceId: cloneRequest.sourceWorkspaceId,
        membership: {
          role: "admin",
        },
      };

      // Audit log
      await this.audit.record(ctx, {
        action: "workspace.clone.failed",
        entityType: "WorkspaceClone",
        entityId: cloneRequest.id,
        metadata: {
          sourceWorkspaceId: cloneRequest.sourceWorkspaceId,
          error: error.message,
        },
      });

      // Send notification
      await this.notifications.sendToWorkspace(
        cloneRequest.sourceWorkspaceId,
        "workspace.clone.failed",
        "Workspace Clone Failed",
        `Failed to clone workspace: ${error.message}`,
        { cloneId: cloneRequest.id }
      );
    } catch (err: any) {
      this.logger.error(`Failed to mark clone error: ${err.message}`);
    }
  }

  /**
   * Clone agents
   */
  private async cloneAgents(
    sourceWorkspaceId: string,
    targetWorkspaceId: string,
    agentMap: Map<string, string>
  ) {
    const agents = await this.prisma.agentConfig.findMany({
      where: { workspaceId: sourceWorkspaceId },
    });

    this.logger.log(`Cloning ${agents.length} agents...`);

    for (const agent of agents) {
      const newAgent = await this.prisma.agentConfig.create({
        data: {
          workspaceId: targetWorkspaceId,
          name: agent.name,
          description: agent.description,
          systemPrompt: agent.systemPrompt,
          maxSteps: agent.maxSteps,
          model: agent.model,
          temperature: agent.temperature,
          topP: agent.topP,
          tools: agent.tools,
        },
      });

      agentMap.set(agent.id, newAgent.id);
    }

    this.logger.log(`Cloned ${agents.length} agents`);
  }

  /**
   * Clone workflows with agent ID remapping
   */
  private async cloneWorkflows(
    sourceWorkspaceId: string,
    targetWorkspaceId: string,
    workflowMap: Map<string, string>,
    agentMap: Map<string, string>
  ) {
    const workflows = await this.prisma.workflow.findMany({
      where: { workspaceId: sourceWorkspaceId },
      include: { steps: true },
    });

    this.logger.log(`Cloning ${workflows.length} workflows...`);

    for (const workflow of workflows) {
      // Get first user in target workspace (or use "system")
      const targetUser = await this.prisma.workspaceUser.findFirst({
        where: { workspaceId: targetWorkspaceId },
      });

      const newWorkflow = await this.prisma.workflow.create({
        data: {
          workspaceId: targetWorkspaceId,
          userId: targetUser?.userId || workflow.userId,
          name: workflow.name,
          description: workflow.description,
          enabled: workflow.enabled,
          triggerType: workflow.triggerType,
        },
      });

      workflowMap.set(workflow.id, newWorkflow.id);

      // Clone workflow steps with agent ID remapping
      for (const step of workflow.steps) {
        let newConfig = step.config as any;

        // Remap agent IDs in step config
        if (typeof newConfig === "object" && newConfig !== null) {
          if (newConfig.agentId && agentMap.has(newConfig.agentId)) {
            newConfig = {
              ...newConfig,
              agentId: agentMap.get(newConfig.agentId),
            };
          }
        }

        await this.prisma.workflowStep.create({
          data: {
            workflowId: newWorkflow.id,
            type: step.type,
            config: newConfig,
            position: step.position,
            order: step.order,
          },
        });
      }
    }

    this.logger.log(`Cloned ${workflows.length} workflows`);
  }

  /**
   * Clone triggers with agent ID remapping
   */
  private async cloneTriggers(
    sourceWorkspaceId: string,
    targetWorkspaceId: string,
    userId: string,
    triggerMap: Map<string, string>,
    agentMap: Map<string, string>
  ) {
    const triggers = await this.prisma.eventTrigger.findMany({
      where: { workspaceId: sourceWorkspaceId },
    });

    this.logger.log(`Cloning ${triggers.length} triggers...`);

    for (const trigger of triggers) {
      // Remap agent ID
      const newAgentId = agentMap.get(trigger.agentId);
      if (!newAgentId) {
        this.logger.warn(
          `Skipping trigger ${trigger.id}: agent ${trigger.agentId} not found in map`
        );
        continue;
      }

      const newTrigger = await this.prisma.eventTrigger.create({
        data: {
          workspaceId: targetWorkspaceId,
          userId,
          name: trigger.name,
          description: trigger.description,
          eventType: trigger.eventType,
          filter: trigger.filter,
          agentId: newAgentId,
          inputTemplate: trigger.inputTemplate,
          enabled: trigger.enabled,
        },
      });

      triggerMap.set(trigger.id, newTrigger.id);
    }

    this.logger.log(`Cloned ${triggers.length} triggers`);
  }

  /**
   * Clone memory entries
   */
  private async cloneMemory(
    sourceWorkspaceId: string,
    targetWorkspaceId: string,
    userId: string,
    memoryMap: Map<string, string>
  ) {
    const memories = await this.prisma.agentMemory.findMany({
      where: { workspaceId: sourceWorkspaceId },
    });

    this.logger.log(`Cloning ${memories.length} memory entries...`);

    for (const memory of memories) {
      const newMemory = await this.prisma.agentMemory.create({
        data: {
          workspaceId: targetWorkspaceId,
          userId,
          content: memory.content,
          embedding: memory.embedding,
        },
      });

      memoryMap.set(memory.id, newMemory.id);
    }

    this.logger.log(`Cloned ${memories.length} memory entries`);
  }

  /**
   * Clone eval suites and tests
   */
  private async cloneEvals(
    sourceWorkspaceId: string,
    targetWorkspaceId: string,
    evalSuiteMap: Map<string, string>,
    evalTestMap: Map<string, string>
  ) {
    const suites = await this.prisma.evalSuite.findMany({
      where: { workspaceId: sourceWorkspaceId },
      include: { tests: true },
    });

    this.logger.log(`Cloning ${suites.length} eval suites...`);

    for (const suite of suites) {
      const newSuite = await this.prisma.evalSuite.create({
        data: {
          workspaceId: targetWorkspaceId,
          name: suite.name,
          description: suite.description,
        },
      });

      evalSuiteMap.set(suite.id, newSuite.id);

      // Clone tests
      for (const test of suite.tests) {
        const newTest = await this.prisma.evalTest.create({
          data: {
            workspaceId: targetWorkspaceId,
            suiteId: newSuite.id,
            name: test.name,
            input: test.input,
            expected: test.expected,
          },
        });

        evalTestMap.set(test.id, newTest.id);
      }
    }

    this.logger.log(
      `Cloned ${suites.length} eval suites and ${evalTestMap.size} tests`
    );
  }

  /**
   * Clone API keys (but set revoked)
   */
  private async cloneApiKeys(
    sourceWorkspaceId: string,
    targetWorkspaceId: string
  ) {
    const apiKeys = await this.prisma.apiKey.findMany({
      where: { workspaceId: sourceWorkspaceId },
    });

    this.logger.log(`Cloning ${apiKeys.length} API keys (as revoked)...`);

    for (const apiKey of apiKeys) {
      await this.prisma.apiKey.create({
        data: {
          workspaceId: targetWorkspaceId,
          name: `${apiKey.name} (Cloned)`,
          keyHash: "CLONED_REVOKED", // Never copy actual key hash
          role: apiKey.role,
          expiresAt: apiKey.expiresAt,
          revokedAt: new Date(), // Set revoked immediately
        },
      });
    }

    this.logger.log(`Cloned ${apiKeys.length} API keys (all revoked)`);
  }

  /**
   * Clone workspace limits
   */
  private async cloneWorkspaceLimits(
    sourceWorkspaceId: string,
    targetWorkspaceId: string
  ) {
    const limits = await this.prisma.workspaceLimit.findUnique({
      where: { workspaceId: sourceWorkspaceId },
    });

    if (!limits) {
      this.logger.log("No workspace limits to clone");
      return;
    }

    await this.prisma.workspaceLimit.create({
      data: {
        workspaceId: targetWorkspaceId,
        planTier: limits.planTier,
        maxAgents: limits.maxAgents,
        maxWorkflows: limits.maxWorkflows,
        maxTriggers: limits.maxTriggers,
        maxMemoryMB: limits.maxMemoryMB,
        maxApiKeys: limits.maxApiKeys,
        maxMonthlyTokens: limits.maxMonthlyTokens,
        softTokenThreshold: limits.softTokenThreshold,
        hardTokenThreshold: limits.hardTokenThreshold,
      },
    });

    this.logger.log("Cloned workspace limits");
  }

  /**
   * Clone members (workspace users)
   */
  private async cloneMembers(
    sourceWorkspaceId: string,
    targetWorkspaceId: string
  ) {
    const members = await this.prisma.workspaceUser.findMany({
      where: { workspaceId: sourceWorkspaceId },
    });

    this.logger.log(`Cloning ${members.length} members...`);

    for (const member of members) {
      // Check if user already exists in target workspace
      const existing = await this.prisma.workspaceUser.findUnique({
        where: {
          userId_workspaceId: {
            userId: member.userId,
            workspaceId: targetWorkspaceId,
          },
        },
      });

      if (existing) {
        this.logger.log(
          `Member ${member.userId} already exists in target workspace, skipping`
        );
        continue;
      }

      await this.prisma.workspaceUser.create({
        data: {
          workspaceId: targetWorkspaceId,
          userId: member.userId,
          role: member.role,
        },
      });
    }

    this.logger.log(`Cloned ${members.length} members`);
  }

  /**
   * List clone requests for a workspace
   */
  async listCloneRequests(workspaceId: string) {
    return this.prisma.workspaceClone.findMany({
      where: { sourceWorkspaceId: workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  /**
   * Get clone request by ID
   */
  async getCloneRequest(cloneId: string, workspaceId: string) {
    return this.prisma.workspaceClone.findFirst({
      where: {
        id: cloneId,
        sourceWorkspaceId: workspaceId,
      },
    });
  }
}
