import { Injectable, Logger, BadRequestException, Inject, forwardRef } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OpenAIService } from "../openai/openai.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { BillingService } from "../billing/billing.service";
import { ModelRegistryService } from "./model-registry.service";
import { AuthContextData } from "../context/auth-context.interface";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface InvokeChatParams {
  modelId?: string;
  deploymentId?: string;
  environment?: 'dev' | 'staging' | 'prod';
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface InvokeChatResult {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
  };
  model: {
    id: string;
    provider: string;
  };
}

@Injectable()
export class ModelGatewayService {
  private readonly logger = new Logger(ModelGatewayService.name);
  private deploymentService: any = null;
  private observabilityService: any = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAIService,
    private readonly analytics: AnalyticsService,
    private readonly registry: ModelRegistryService,
    private readonly billing: BillingService
  ) {
    this.initServices();
  }

  private async initServices() {
    try {
      const { ModelDeploymentService } = await import("./deployment/model-deployment.service");
      this.deploymentService = ModelDeploymentService;
      const { ObservabilityService } = await import("../observability/observability.service");
      this.observabilityService = ObservabilityService;
    } catch (error) {
      // Services not available yet
    }
  }

  async invokeChat(
    ctx: AuthContextData,
    params: InvokeChatParams
  ): Promise<InvokeChatResult> {
    return this.invokeChatInternal(ctx, params);
  }

  async invokeChatExternal(
    ctx: AuthContextData,
    params: InvokeChatParams
  ): Promise<InvokeChatResult> {
    return this.invokeChatInternal(ctx, params);
  }

  /**
   * Resolve model configuration from deployment, version, or direct model
   */
  private async resolveModelConfig(
    ctx: AuthContextData,
    options: {
      deploymentId?: string;
      modelId?: string;
      environment?: 'dev' | 'staging' | 'prod';
    }
  ): Promise<{
    config: any;
    metadata: {
      source: 'deployment' | 'version' | 'registry' | 'default';
      modelVersionId?: string;
      modelDeploymentId?: string;
      environment?: string;
      modelId?: string;
    };
  }> {
    // Priority: deploymentId > modelId + environment > modelId (with latest version) > default

    // Record resolution billing
    try {
      await this.billing.recordUsage(ctx, "model.resolution", 1, 0.00002, {
        deploymentId: options.deploymentId,
        modelId: options.modelId,
        environment: options.environment,
      });
    } catch (error: any) {
      this.logger.error(`Failed to record model resolution billing: ${error.message}`);
    }

    // Try deploymentId first
    if (options.deploymentId) {
      try {
        const deployment = await this.prisma.modelDeployment.findFirst({
          where: {
            id: options.deploymentId,
            workspaceId: ctx.workspaceId,
          },
          include: {
            version: true,
          },
        });

        if (deployment) {
          return {
            config: deployment.version.config,
            metadata: {
              source: 'deployment',
              modelVersionId: deployment.versionId,
              modelDeploymentId: deployment.id,
              environment: deployment.environment,
              modelId: deployment.modelId,
            },
          };
        }
      } catch (error: any) {
        this.logger.error(`Failed to resolve deployment: ${error.message}`);
      }
    }

    // Try modelId + environment
    if (options.modelId && options.environment) {
      try {
        const deployment = await this.prisma.modelDeployment.findFirst({
          where: {
            modelId: options.modelId,
            environment: options.environment,
            workspaceId: ctx.workspaceId,
          },
          include: {
            version: true,
          },
        });

        if (deployment) {
          return {
            config: deployment.version.config,
            metadata: {
              source: 'deployment',
              modelVersionId: deployment.versionId,
              modelDeploymentId: deployment.id,
              environment: deployment.environment,
              modelId: deployment.modelId,
            },
          };
        }
      } catch (error: any) {
        this.logger.error(`Failed to resolve environment deployment: ${error.message}`);
      }
    }

    // Try latest ModelVersion for modelId
    if (options.modelId) {
      try {
        const model = await this.prisma.model.findFirst({
          where: {
            id: options.modelId,
            workspaceId: ctx.workspaceId,
          },
        });

        if (model) {
          const latestVersion = await this.prisma.modelVersion.findFirst({
            where: {
              modelId: options.modelId,
              workspaceId: ctx.workspaceId,
            },
            orderBy: {
              version: "desc",
            },
          });

          if (latestVersion) {
            return {
              config: latestVersion.config,
              metadata: {
                source: 'version',
                modelVersionId: latestVersion.id,
                modelId: options.modelId,
              },
            };
          }

          // No version, use raw model config
          return {
            config: {
              name: model.name,
              provider: model.provider,
              modelName: model.modelName,
              maxTokens: model.maxTokens,
              temperature: model.temperature,
              topP: model.topP,
            },
            metadata: {
              source: 'registry',
              modelId: model.id,
            },
          };
        }
      } catch (error: any) {
        this.logger.error(`Failed to resolve model: ${error.message}`);
      }
    }

    // Fallback to default registry model
    return {
      config: this.registry.getDefaultModel(),
      metadata: {
        source: 'default',
      },
    };
  }

  private async invokeChatInternal(
    ctx: AuthContextData,
    params: InvokeChatParams
  ): Promise<InvokeChatResult> {
    // Resolve model configuration
    const resolved = await this.resolveModelConfig(ctx, {
      deploymentId: params.deploymentId,
      modelId: params.modelId,
      environment: params.environment,
    });

    // Get model from registry (for API calls)
    const model = resolved.config.modelName
      ? this.registry.getById(resolved.config.modelName)
      : (resolved.config.id ? this.registry.getById(resolved.config.id) : this.registry.getDefaultModel());

    // Enforce maxTokens
    const maxTokens = params.maxTokens
      ? Math.min(params.maxTokens, model.maxTokens)
      : undefined;

    if (params.maxTokens && params.maxTokens > model.maxTokens) {
      throw new BadRequestException(
        `maxTokens (${params.maxTokens}) exceeds model limit (${model.maxTokens})`
      );
    }

    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;
    let cost = 0;
    let status = "success";
    let error: string | undefined;
    let content = "";

    try {
      // Call OpenAI with resolved config
      const client = this.openai.getClient();
      const response = await client.chat.completions.create({
        model: model.id,
        messages: params.messages as any,
        temperature: params.temperature ?? resolved.config.temperature ?? 0.2,
        max_tokens: maxTokens,
      });

      // Extract usage
      inputTokens = response.usage?.prompt_tokens || 0;
      outputTokens = response.usage?.completion_tokens || 0;
      totalTokens = response.usage?.total_tokens || inputTokens + outputTokens;

      // Compute cost
      cost = this.registry.estimateCost(model.id, inputTokens, outputTokens);

      // Extract content
      content = response.choices[0]?.message?.content || "";

      this.logger.log(
        `Model invocation succeeded: ${model.id} (${totalTokens} tokens, $${cost.toFixed(6)})`
      );
    } catch (err: any) {
      status = "failed";
      error = err.message || "Unknown error";
      this.logger.error(`Model invocation failed: ${error}`);
      throw err;
    } finally {
      // Log invocation to database with deployment metadata
      try {
        await this.prisma.modelInvocation.create({
          data: {
            workspaceId: ctx.workspaceId,
            model: model.id,
            provider: model.provider,
            status,
            inputTokens,
            outputTokens,
            totalTokens,
            cost,
            error,
          },
        });
      } catch (dbError: any) {
        this.logger.error(`Failed to log model invocation: ${dbError.message}`);
      }

      // Log observability event with deployment metadata
      if (this.observabilityService) {
        try {
          const obsService = new this.observabilityService(this.prisma);
          await obsService.logEvent(ctx, {
            category: "model",
            eventType: "model.invoke",
            entityId: model.id,
            entityType: "model",
            durationMs: 0, // Will be calculated elsewhere
            success: status === "success",
            metadata: {
              modelId: model.id,
              provider: model.provider,
              deploymentSource: resolved.metadata.source,
              modelVersionId: resolved.metadata.modelVersionId,
              modelDeploymentId: resolved.metadata.modelDeploymentId,
              environment: resolved.metadata.environment,
              inputTokens,
              outputTokens,
              totalTokens,
              cost,
            },
          });
        } catch (obsError: any) {
          this.logger.error(`Failed to log observability event: ${obsError.message}`);
        }
      }

      // Record analytics event
      if (status === "success") {
        try {
          await this.analytics.recordEvent(ctx, "model.call", {
            model: model.id,
            provider: model.provider,
            inputTokens,
            outputTokens,
            totalTokens,
            cost,
          });
        } catch (analyticsError: any) {
          this.logger.error(
            `Failed to record analytics event: ${analyticsError.message}`
          );
        }

        // Record billing usage
        try {
          await this.billing.recordUsage(ctx, "model.invoke", totalTokens, cost, {
            modelId: model.id,
            promptTokens: inputTokens,
            completionTokens: outputTokens,
          });
        } catch (billingError: any) {
          this.logger.error(
            `Failed to record billing usage: ${billingError.message}`
          );
        }
      }
    }

    return {
      content,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens,
        cost,
      },
      model: {
        id: model.id,
        provider: model.provider,
      },
    };
  }
}
