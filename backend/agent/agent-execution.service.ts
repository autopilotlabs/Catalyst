import { Injectable, Inject, forwardRef, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OpenAIService } from "../openai/openai.service";
import { BillingService } from "../billing/billing.service";
import { AuthContextData } from "../context/auth-context.interface";
import { ToolRegistryService } from "./tools/tool-registry.service";
import { MemoryService } from "./memory/memory.service";
import { StepLoggerService } from "./steps/step-logger.service";
import { AgentStateService } from "./state/state.service";
import { AgentRegistryService } from "./registry/agent-registry.service";
import { PluginRegistryService } from "./plugins/plugin-registry.service";
import { PluginExecutorService } from "./plugins/plugin-executor.service";
import { AuditService } from "../audit/audit.service";
import { EnvService } from "../env/env.service";
import { AgentDeploymentService } from "./deployment/agent-deployment.service";

@Injectable()
export class AgentExecutionService {
  private readonly logger = new Logger(AgentExecutionService.name);
  private analyticsService: any = null;
  private notificationsService: any = null;
  private realtimeService: any = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAIService,
    private readonly billing: BillingService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly memoryService: MemoryService,
    private readonly stepLogger: StepLoggerService,
    private readonly agentStateService: AgentStateService,
    private readonly registry: AgentRegistryService,
    private readonly pluginRegistry: PluginRegistryService,
    private readonly pluginExecutor: PluginExecutorService,
    private readonly auditService: AuditService,
    private readonly envService: EnvService,
    @Inject(forwardRef(() => require('../observability/observability.service').ObservabilityService))
    private readonly observability: any,
    @Inject(forwardRef(() => require('./deployment/agent-deployment.service').AgentDeploymentService))
    private readonly deploymentService: any
  ) {
    // Lazy load analytics service to avoid circular dependency
    this.initAnalyticsService();
    this.initNotificationsService();
    this.initRealtimeService();
  }

  private async initAnalyticsService() {
    try {
      const { AnalyticsService } = await import("../analytics/analytics.service");
      // Store the class for later instantiation
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

  async executeRun(ctx: AuthContextData, runId: string) {
    // Load AgentRun by runId, userId, workspaceId
    const run = await this.prisma.agentRun.findFirst({
      where: {
        id: runId,
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!run) {
      throw new Error("Agent run not found or access denied");
    }

    try {
      const startTime = Date.now();

      // Update status to "running"
      await this.prisma.agentRun.update({
        where: { id: runId },
        data: { status: "running" },
      });

      // Log agent run started
      if (this.observability?.logEvent) {
        await this.observability.logEvent(ctx, {
          category: "agent",
          eventType: "agent.run.started",
          entityId: runId,
          entityType: "agent",
          metadata: { agentId: run.agentId },
        });
      }

      // Broadcast status update
      await this.broadcastRunUpdate(ctx.workspaceId, runId, "running", null, null);

      // Resolve environment variables for this workspace
      const env = await this.envService.resolveAllForWorkspace(ctx);

      // Call OpenAI API
      const modelStart = Date.now();
      const client = this.openai.getClient();
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an AI agent." },
          { role: "user", content: JSON.stringify(run.input) },
        ],
      });
      const modelDuration = Date.now() - modelStart;

      const assistantMessage = completion.choices[0].message.content;

      // Log model invocation
      if (this.observability?.logEvent) {
        await this.observability.logEvent(ctx, {
          category: "model",
          eventType: "model.invoke",
          entityId: runId,
          entityType: "agent",
          durationMs: modelDuration,
          success: true,
          metadata: {
            model: "gpt-4o-mini",
            tokens: completion.usage?.total_tokens || 0,
            inputTokens: completion.usage?.prompt_tokens || 0,
            outputTokens: completion.usage?.completion_tokens || 0,
          },
        });
      }

      // Save assistant response to AgentMessage
      await this.prisma.agentMessage.create({
        data: {
          runId: run.id,
          role: "assistant",
          content: assistantMessage || "",
        },
      });

      // Update status to "completed"
      await this.prisma.agentRun.update({
        where: { id: runId },
        data: { status: "completed" },
      });

      // Record billing usage for agent run
      const agentCost = 0.002; // $0.002 per agent run
      try {
        await this.billing.recordUsage(ctx, "agent.run", 1, agentCost, {
          agentId: run.agentId,
          runId: runId,
        });
      } catch (billingError: any) {
        this.logger.error(`Failed to record agent billing: ${billingError.message}`);
      }

      // Log agent run completed
      const totalDuration = Date.now() - startTime;
      if (this.observability?.logEvent) {
        await this.observability.logEvent(ctx, {
          category: "agent",
          eventType: "agent.run.completed",
          entityId: runId,
          entityType: "agent",
          durationMs: totalDuration,
          success: true,
          metadata: { agentId: run.agentId },
        });
      }

      // Broadcast status update
      await this.broadcastRunUpdate(ctx.workspaceId, runId, "completed", assistantMessage, null);

      return {
        runId: run.id,
        status: "completed",
        output: assistantMessage,
      };
    } catch (error: any) {
      // Save error message
      await this.prisma.agentMessage.create({
        data: {
          runId: run.id,
          role: "system",
          content: `Error: ${error.message}`,
        },
      });

      // Update status to "error"
      await this.prisma.agentRun.update({
        where: { id: runId },
        data: { status: "error" },
      });

      // Broadcast status update
      await this.broadcastRunUpdate(ctx.workspaceId, runId, "error", null, error.message);

      throw error;
    }
  }

  async *streamRun(ctx: AuthContextData, runId: string) {
    // Validate run ownership
    const run = await this.prisma.agentRun.findFirst({
      where: {
        id: runId,
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!run) {
      throw new Error("Agent run not found or access denied");
    }

    try {
      // Update status to "running"
      await this.prisma.agentRun.update({
        where: { id: runId },
        data: { status: "running" },
      });

      // Fetch short-term memory (recent messages from this run)
      const shortTermMessages = await this.prisma.agentMessage.findMany({
        where: { runId },
        orderBy: { createdAt: "asc" },
        take: 10,
      });

      // Fetch long-term memory (semantic search based on input)
      const longTerm = await this.memoryService.searchMemory(
        ctx,
        JSON.stringify(run.input),
        5
      );

      // Build memory context
      const memoryContext: any[] = [];
      if (longTerm.length > 0) {
        memoryContext.push({
          role: "system",
          content: "Here are relevant prior memories:" +
            longTerm.map(m => `\n- ${m.content}`).join("")
        });
      }

      // Call OpenAI with streaming enabled and tools
      const client = this.openai.getClient();
      const builtinTools = this.toolRegistry.getToolDefinitions();
      const pluginTools = await this.pluginRegistry.getWorkspaceToolDefinitions(
        ctx.workspaceId
      );
      const tools = [...builtinTools, ...pluginTools];

      const messages = [
        ...memoryContext,
        ...shortTermMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        { role: "system", content: "You are an AI agent with access to tools." },
        { role: "user", content: JSON.stringify(run.input) },
      ];

      const stream = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        tools,
        stream: true,
      });

      let fullContent = "";
      let toolCalls: any[] = [];

      // Consume stream chunks
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          fullContent += delta.content;
          yield { type: "content", content: delta.content };
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (!toolCalls[tc.index]) {
              toolCalls[tc.index] = { id: tc.id, name: "", arguments: "" };
            }
            if (tc.function?.name) {
              toolCalls[tc.index].name = tc.function.name;
            }
            if (tc.function?.arguments) {
              toolCalls[tc.index].arguments += tc.function.arguments;
            }
          }
        }
      }

      // Execute tools
      for (const tc of toolCalls) {
        if (!tc.name) continue;

        // Check if it's a built-in tool
        const builtinTool = this.toolRegistry.getTool(tc.name);
        
        // Check if it's a plugin tool
        const pluginTool = await this.pluginRegistry.getToolByName(
          ctx.workspaceId,
          tc.name
        );

        if (!builtinTool && !pluginTool) {
          yield { type: "tool_call", name: tc.name, error: "Tool not found" };
          continue;
        }

        try {
          const args = JSON.parse(tc.arguments);
          let result: any;

          // Execute built-in or plugin tool
          if (builtinTool) {
            result = await builtinTool.execute(ctx, args);
          } else if (pluginTool) {
            result = await this.pluginExecutor.execute(
              pluginTool.code,
              args,
              ctx
            );
          }

          const message = await this.prisma.agentMessage.create({
            data: {
              runId,
              role: "tool",
              content: JSON.stringify(result),
            },
          });

          await this.prisma.agentToolCall.create({
            data: {
              runId,
              messageId: message.id,
              toolName: tc.name,
              arguments: args as any,
              result: result as any,
            },
          });

          yield { type: "tool_call", name: tc.name, result };
        } catch (error: any) {
          const message = await this.prisma.agentMessage.create({
            data: {
              runId,
              role: "tool",
              content: `Error: ${error.message}`,
            },
          });

          await this.prisma.agentToolCall.create({
            data: {
              runId,
              messageId: message.id,
              toolName: tc.name,
              arguments: JSON.parse(tc.arguments) as any,
              error: error.message,
            },
          });

          yield { type: "tool_call", name: tc.name, error: error.message };
        }
      }

      // Save assistant response if any
      if (fullContent) {
        await this.prisma.agentMessage.create({
          data: {
            runId: run.id,
            role: "assistant",
            content: fullContent,
          },
        });
      }

      // Store memories after run completion
      await this.memoryService.storeMemory(
        ctx,
        `User Input: ${JSON.stringify(run.input)}`
      );

      if (fullContent) {
        await this.memoryService.storeMemory(
          ctx,
          `Agent Response: ${fullContent}`
        );
      }

      // Update status to "completed"
      await this.prisma.agentRun.update({
        where: { id: runId },
        data: { status: "completed" },
      });
    } catch (error: any) {
      // Save error message
      await this.prisma.agentMessage.create({
        data: {
          runId: run.id,
          role: "system",
          content: `Error: ${error.message}`,
        },
      });

      // Update status to "error"
      await this.prisma.agentRun.update({
        where: { id: runId },
        data: { status: "error" },
      });

      // Send failure notification
      await this.sendFailureNotification(ctx, run.id, error.message);

      throw error;
    }
  }

  async getMemoryContext(ctx: AuthContextData, runId: string): Promise<string> {
    const run = await this.prisma.agentRun.findFirst({
      where: { id: runId },
    });

    if (!run) return "";

    const longTerm = await this.memoryService.searchMemory(
      ctx,
      JSON.stringify(run.input),
      5
    );

    if (longTerm.length === 0) return "";

    return longTerm.map(m => `- ${m.content}`).join("\n");
  }

  /**
   * Resolve agent configuration from deployment or direct agent config
   */
  async resolveAgentConfig(
    ctx: AuthContextData,
    options: {
      agentId?: string;
      deploymentId?: string;
      environment?: 'dev' | 'staging' | 'prod';
    }
  ): Promise<{
    config: any;
    metadata: {
      source: 'deployment' | 'agent' | 'default';
      versionId?: string;
      deploymentId?: string;
      agentId?: string;
    };
  }> {
    // Priority: deploymentId > agentId + environment > agentId
    if (options.deploymentId) {
      const deployment = await this.deploymentService.getDeploymentById(ctx, options.deploymentId);
      return {
        config: deployment.version.config,
        metadata: {
          source: 'deployment',
          versionId: deployment.versionId,
          deploymentId: deployment.id,
          agentId: deployment.agentId,
        },
      };
    }

    if (options.agentId && options.environment) {
      const deployment = await this.deploymentService.getDeploymentForEnvironment(
        ctx,
        options.agentId,
        options.environment
      );
      if (deployment) {
        return {
          config: deployment.version.config,
          metadata: {
            source: 'deployment',
            versionId: deployment.versionId,
            deploymentId: deployment.id,
            agentId: deployment.agentId,
          },
        };
      }
    }

    if (options.agentId) {
      const agentConfig = await this.registry.getAgent(options.agentId, ctx.workspaceId);
      return {
        config: agentConfig,
        metadata: {
          source: 'agent',
          agentId: options.agentId,
        },
      };
    }

    // Default config
    return {
      config: {
        systemPrompt: "You are an autonomous agent.",
        model: "gpt-4o-mini",
        maxSteps: 8,
        temperature: 0.7,
        topP: 1.0,
        tools: [],
      },
      metadata: {
        source: 'default',
      },
    };
  }

  async multiStepRun(
    ctx: AuthContextData,
    runId: string,
    maxSteps = 8,
    deploymentOptions?: {
      deploymentId?: string;
      environment?: 'dev' | 'staging' | 'prod';
    }
  ) {
    const run = await this.prisma.agentRun.findFirst({
      where: {
        id: runId,
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!run) {
      throw new Error("Agent run not found or access denied");
    }

    // Resolve agent configuration (from deployment or agent)
    const resolved = await this.resolveAgentConfig(ctx, {
      agentId: run.agentId || undefined,
      deploymentId: deploymentOptions?.deploymentId,
      environment: deploymentOptions?.environment,
    });

    const agentConfig = resolved.config;

    // Use config values or defaults
    const systemPrompt = agentConfig?.systemPrompt || "You are an autonomous agent.";
    const model = agentConfig?.model || "gpt-4o-mini";
    const configMaxSteps = agentConfig?.maxSteps ?? maxSteps;
    const temperature = agentConfig?.temperature ?? 0.7;
    const topP = agentConfig?.topP ?? 1.0;

    // Initialize state if it doesn't exist
    let state = await this.agentStateService.get(runId);
    if (!state) {
      state = await this.agentStateService.initialize(runId);
    }

    let step = 1;

    await this.prisma.agentRun.update({
      where: { id: runId },
      data: { status: "running" },
    });

    try {
      while (step <= configMaxSteps) {
        // 1. Build context with memory + previous steps
        const previousSteps = await this.prisma.agentStep.findMany({
          where: { runId },
          orderBy: { stepNumber: "asc" },
        });

        const summary = previousSteps
          .map(s => `[${s.stepNumber}] ${s.type}: ${s.action || s.toolName}`)
          .join("\n");

        const memory = await this.getMemoryContext(ctx, runId);

        // Refresh state
        state = await this.agentStateService.get(runId);

        // 2. Ask model what to do next
        const client = this.openai.getClient();
        const builtinTools = this.toolRegistry.getToolDefinitions();
        const pluginTools = await this.pluginRegistry.getWorkspaceToolDefinitions(
          ctx.workspaceId
        );
        const tools = [...builtinTools, ...pluginTools];

        const messages: any[] = [
          { role: "system", content: systemPrompt },
        ];

        if (memory) {
          messages.push({
            role: "system",
            content: "Here is the memory context:\n" + memory,
          });
        }

        if (state) {
          messages.push({
            role: "system",
            content: "Here is your current persistent state:\n" + JSON.stringify(state.state, null, 2),
          });
        }

        if (summary) {
          messages.push({
            role: "system",
            content: "Here is what has happened so far:\n" + summary,
          });
        }

        messages.push({
          role: "user",
          content: `Task: ${JSON.stringify(run.input)}\n\nContinue working toward completing the task.`,
        });

        const completion = await client.chat.completions.create({
          model,
          messages,
          tools,
          temperature,
          top_p: topP,
        });

        const choice = completion.choices[0];
        const nextStep = choice.message;

        // 3. If model emits content with no tool call → final answer
        if (!nextStep.tool_calls || nextStep.tool_calls.length === 0) {
          await this.stepLogger.logModelStep(
            runId,
            step,
            nextStep.content || "Task completed"
          );

          // Update state with final output
          await this.agentStateService.update(runId, { 
            final_output: nextStep.content || "Task completed" 
          });

          await this.prisma.agentRun.update({
            where: { id: runId },
            data: {
              status: "completed",
              output: nextStep.content || "Task completed",
            },
          });

          // Store memory
          if (nextStep.content) {
            await this.memoryService.storeMemory(
              ctx,
              `Agent completed task: ${nextStep.content}`
            );
          }

          const finalState = await this.agentStateService.get(runId);

          // Record analytics
          await this.recordRunAnalytics(ctx, run.id, run.agentId, 0);

          // Audit log for run completion
          await this.auditService.logAgentEvent(ctx, {
            action: "agent.run.completed",
            entityType: "run",
            entityId: runId,
            metadata: {
              agentId: run.agentId,
              status: "completed",
              model,
              deploymentSource: resolved.metadata.source,
              versionId: resolved.metadata.versionId,
              deploymentId: resolved.metadata.deploymentId,
            },
          });

          return {
            output: nextStep.content || "Task completed",
            state: finalState,
          };
        }

        // 4. Execute tool calls
        for (const tc of nextStep.tool_calls) {
          if (tc.type !== "function") continue;

          // Check if it's a built-in tool
          const builtinTool = this.toolRegistry.getTool(tc.function.name);
          
          // Check if it's a plugin tool
          const pluginTool = await this.pluginRegistry.getToolByName(
            ctx.workspaceId,
            tc.function.name
          );

          if (!builtinTool && !pluginTool) {
            await this.stepLogger.logToolStep(
              runId,
              step,
              tc.function.name,
              {},
              { error: "Tool not found" }
            );
            continue;
          }

          try {
            const args = JSON.parse(tc.function.arguments);
            let result: any;

            // Execute built-in or plugin tool
            if (builtinTool) {
              result = await builtinTool.execute(ctx, args);
            } else if (pluginTool) {
              result = await this.pluginExecutor.execute(
                pluginTool.code,
                args,
                ctx
              );
            }

          await this.stepLogger.logToolStep(
            runId,
            step,
            tc.function.name,
            args,
            result
          );

          // Audit log for tool execution
          await this.auditService.logAgentEvent(ctx, {
            action: "agent.tool.executed",
            entityType: "tool",
            entityId: tc.function.name,
            metadata: {
              runId,
              toolName: tc.function.name,
              arguments: args,
              success: true,
            },
          });
          } catch (error: any) {
            await this.stepLogger.logToolStep(
              runId,
              step,
              tc.function.name,
              JSON.parse(tc.function.arguments),
              { error: error.message }
            );
          }
        }

        step += 1;
      }

      // 5. Max steps reached
      await this.prisma.agentRun.update({
        where: { id: runId },
        data: { status: "failed", output: "Max steps reached." },
      });

      throw new Error("Max steps reached");
    } catch (error: any) {
      await this.prisma.agentRun.update({
        where: { id: runId },
        data: { status: "error", output: error.message },
      });

      // Send failure notification
      await this.sendFailureNotification(ctx, runId, error.message);

      throw error;
    }
  }

  private async sendFailureNotification(
    ctx: AuthContextData,
    runId: string,
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
          ctx.workspaceId,
          "agent.run.failed",
          "Agent Run Failed",
          `Agent run ${runId} failed with error: ${errorMessage}`,
          {
            runId,
            error: errorMessage,
            userId: ctx.userId,
          }
        );
      }
    } catch (error) {
      // Silently fail notification sending
    }
  }

  private async recordRunAnalytics(
    ctx: AuthContextData,
    runId: string,
    agentId: string | null,
    tokens: number
  ): Promise<void> {
    try {
      if (!this.analyticsService) {
        await this.initAnalyticsService();
      }

      if (this.analyticsService) {
        const analyticsService = new this.analyticsService(this.prisma);
        await analyticsService.recordEvent(ctx, "run.completed", {
          runId,
          agentId,
          tokens,
        });
      }
    } catch (error) {
      // Silently fail analytics recording
    }
  }

  private async broadcastRunUpdate(
    workspaceId: string,
    runId: string,
    status: string,
    output: string | null,
    error: string | null
  ): Promise<void> {
    try {
      if (!this.realtimeService) {
        await this.initRealtimeService();
      }

      if (this.realtimeService) {
        const realtimeService = new this.realtimeService();
        // Note: This won't work without proper DI, but structure is correct
        // In production, inject RealtimeService via constructor
        this.logger.debug(
          `[Realtime] Would broadcast agent.run.update for run ${runId}`
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
    this.logger.log(`Executing agent job: ${job.id}`);

    const { runId, userId, workspaceId, role } = payload;

    // Reconstruct auth context
    const ctx: AuthContextData = {
      userId,
      workspaceId,
      membership: {
        role: (role || "member") as 'owner' | 'admin' | 'member' | 'viewer',
      },
    };

    // Execute the run
    await this.multiStepRun(ctx, runId);
  }
}
