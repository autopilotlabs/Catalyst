import { Injectable, Logger, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.service";
import { BillingService } from "../../billing/billing.service";
import { ObservabilityService } from "../../observability/observability.service";
import { AuthContextData } from "../../context/auth-context.interface";
import { ModelVersion } from "@prisma/client";

@Injectable()
export class ModelVersionService {
  private readonly logger = new Logger(ModelVersionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
    private readonly observability: ObservabilityService
  ) {}

  /**
   * Create a new version from current model config
   */
  async createVersionFromModel(
    ctx: AuthContextData,
    modelId: string,
    label?: string
  ): Promise<ModelVersion> {
    // Check permissions - only owner and admin can create versions
    if (ctx.membership?.role !== "owner" && ctx.membership?.role !== "admin") {
      throw new ForbiddenException("Only owners and admins can create model versions");
    }

    // Fetch the model
    const model = await this.prisma.model.findFirst({
      where: {
        id: modelId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!model) {
      throw new NotFoundException("Model not found");
    }

    // Get current version count for this model
    const versionCount = await this.prisma.modelVersion.count({
      where: { modelId },
    });

    const nextVersion = versionCount + 1;

    // Build config snapshot
    const configSnapshot = {
      name: model.name,
      provider: model.provider,
      modelName: model.modelName,
      maxTokens: model.maxTokens,
      temperature: model.temperature,
      topP: model.topP,
      headers: model.headers,
      apiKeyRefs: model.apiKeyRefs,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };

    // Create version
    const version = await this.prisma.modelVersion.create({
      data: {
        workspaceId: ctx.workspaceId,
        modelId,
        version: nextVersion,
        label: label || `v${nextVersion}`,
        config: configSnapshot as any,
        createdById: ctx.userId,
      },
    });

    // Audit log
    await this.audit.record(ctx, {
      action: "model.version.created",
      entityType: "ModelVersion",
      entityId: version.id,
      metadata: {
        modelId,
        version: nextVersion,
        label: version.label,
      },
    });

    // Observability event
    await this.observability.logEvent(ctx, {
      category: "model",
      eventType: "model.version.created",
      entityId: version.id,
      entityType: "version",
      success: true,
      metadata: {
        modelId,
        version: nextVersion,
        label: version.label,
      },
    });

    // Billing usage
    try {
      await this.billing.recordUsage(ctx, "model.version", 1, 0.001, {
        versionId: version.id,
        modelId,
      });
    } catch (error: any) {
      this.logger.error(`Failed to record billing for version creation: ${error.message}`);
    }

    return version;
  }

  /**
   * List all versions for a model
   */
  async listVersions(
    ctx: AuthContextData,
    modelId: string
  ): Promise<ModelVersion[]> {
    // Verify model exists and user has access
    const model = await this.prisma.model.findFirst({
      where: {
        id: modelId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!model) {
      throw new NotFoundException("Model not found");
    }

    // List versions
    const versions = await this.prisma.modelVersion.findMany({
      where: {
        modelId,
        workspaceId: ctx.workspaceId,
      },
      orderBy: {
        version: "desc",
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return versions;
  }

  /**
   * Get a single version by ID
   */
  async getVersion(
    ctx: AuthContextData,
    versionId: string
  ): Promise<ModelVersion> {
    const version = await this.prisma.modelVersion.findFirst({
      where: {
        id: versionId,
        workspaceId: ctx.workspaceId,
      },
      include: {
        model: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!version) {
      throw new NotFoundException("Version not found");
    }

    return version;
  }

  /**
   * Get the latest version for a model
   */
  async getLatestVersion(
    ctx: AuthContextData,
    modelId: string
  ): Promise<ModelVersion | null> {
    // Verify model exists and user has access
    const model = await this.prisma.model.findFirst({
      where: {
        id: modelId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!model) {
      throw new NotFoundException("Model not found");
    }

    const version = await this.prisma.modelVersion.findFirst({
      where: {
        modelId,
        workspaceId: ctx.workspaceId,
      },
      orderBy: {
        version: "desc",
      },
    });

    return version;
  }
}
