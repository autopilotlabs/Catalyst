import { Injectable, Logger, ForbiddenException, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.service";
import { BillingService } from "../../billing/billing.service";
import { ObservabilityService } from "../../observability/observability.service";
import { AuthContextData } from "../../context/auth-context.interface";
import { ModelDeployment } from "@prisma/client";

type Environment = 'dev' | 'staging' | 'prod';

@Injectable()
export class ModelDeploymentService {
  private readonly logger = new Logger(ModelDeploymentService.name);
  private readonly VALID_ENVIRONMENTS: Environment[] = ['dev', 'staging', 'prod'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
    private readonly observability: ObservabilityService
  ) {}

  /**
   * Create a new deployment
   */
  async createDeployment(
    ctx: AuthContextData,
    modelId: string,
    versionId: string,
    environment: Environment,
    alias?: string
  ): Promise<ModelDeployment> {
    // Check permissions - only owner and admin can create deployments
    if (ctx.membership?.role !== "owner" && ctx.membership?.role !== "admin") {
      throw new ForbiddenException("Only owners and admins can create deployments");
    }

    // Validate environment
    if (!this.VALID_ENVIRONMENTS.includes(environment)) {
      throw new BadRequestException(`Invalid environment. Must be one of: ${this.VALID_ENVIRONMENTS.join(", ")}`);
    }

    // Verify model exists
    const model = await this.prisma.model.findFirst({
      where: {
        id: modelId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!model) {
      throw new NotFoundException("Model not found");
    }

    // Verify version exists and belongs to this model
    const version = await this.prisma.modelVersion.findFirst({
      where: {
        id: versionId,
        modelId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!version) {
      throw new NotFoundException("Version not found or does not belong to this model");
    }

    // Upsert deployment (replace existing if present)
    const deployment = await this.prisma.modelDeployment.upsert({
      where: {
        workspaceId_environment_modelId: {
          workspaceId: ctx.workspaceId,
          environment,
          modelId,
        },
      },
      update: {
        versionId,
        alias,
        createdById: ctx.userId,
        updatedAt: new Date(),
      },
      create: {
        workspaceId: ctx.workspaceId,
        modelId,
        versionId,
        environment,
        alias,
        createdById: ctx.userId,
      },
    });

    // Audit log
    await this.audit.record(ctx, {
      action: "model.deployment.created",
      entityType: "ModelDeployment",
      entityId: deployment.id,
      metadata: {
        modelId,
        versionId,
        environment,
        alias,
      },
    });

    // Observability event
    await this.observability.logEvent(ctx, {
      category: "model",
      eventType: "model.deployment.created",
      entityId: deployment.id,
      entityType: "deployment",
      success: true,
      metadata: {
        modelId,
        versionId,
        environment,
        alias,
      },
    });

    // Billing usage
    try {
      await this.billing.recordUsage(ctx, "model.deployment", 1, 0.002, {
        deploymentId: deployment.id,
        modelId,
        environment,
      });
    } catch (error: any) {
      this.logger.error(`Failed to record billing for deployment: ${error.message}`);
    }

    return deployment;
  }

  /**
   * List all deployments for a model
   */
  async listDeployments(
    ctx: AuthContextData,
    modelId: string
  ): Promise<ModelDeployment[]> {
    // Verify model exists
    const model = await this.prisma.model.findFirst({
      where: {
        id: modelId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!model) {
      throw new NotFoundException("Model not found");
    }

    // List deployments
    const deployments = await this.prisma.modelDeployment.findMany({
      where: {
        modelId,
        workspaceId: ctx.workspaceId,
      },
      include: {
        version: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return deployments;
  }

  /**
   * Get a single deployment by ID
   */
  async getDeploymentById(
    ctx: AuthContextData,
    deploymentId: string
  ): Promise<ModelDeployment> {
    const deployment = await this.prisma.modelDeployment.findFirst({
      where: {
        id: deploymentId,
        workspaceId: ctx.workspaceId,
      },
      include: {
        version: true,
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

    if (!deployment) {
      throw new NotFoundException("Deployment not found");
    }

    return deployment;
  }

  /**
   * Get deployment for a specific environment
   */
  async getDeploymentForEnvironment(
    ctx: AuthContextData,
    modelId: string,
    environment: Environment
  ): Promise<ModelDeployment | null> {
    // Validate environment
    if (!this.VALID_ENVIRONMENTS.includes(environment)) {
      throw new BadRequestException(`Invalid environment. Must be one of: ${this.VALID_ENVIRONMENTS.join(", ")}`);
    }

    // Verify model exists
    const model = await this.prisma.model.findFirst({
      where: {
        id: modelId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!model) {
      throw new NotFoundException("Model not found");
    }

    const deployment = await this.prisma.modelDeployment.findFirst({
      where: {
        modelId,
        environment,
        workspaceId: ctx.workspaceId,
      },
      include: {
        version: true,
      },
    });

    return deployment;
  }

  /**
   * Promote a deployment from one environment to another
   */
  async promoteDeployment(
    ctx: AuthContextData,
    fromDeploymentId: string,
    targetEnvironment: 'staging' | 'prod'
  ): Promise<ModelDeployment> {
    // Check permissions
    if (ctx.membership?.role !== "owner" && ctx.membership?.role !== "admin") {
      throw new ForbiddenException("Only owners and admins can promote deployments");
    }

    // Validate target environment
    if (targetEnvironment !== 'staging' && targetEnvironment !== 'prod') {
      throw new BadRequestException("Target environment must be 'staging' or 'prod'");
    }

    // Load source deployment
    const sourceDeployment = await this.prisma.modelDeployment.findFirst({
      where: {
        id: fromDeploymentId,
        workspaceId: ctx.workspaceId,
      },
      include: {
        version: true,
      },
    });

    if (!sourceDeployment) {
      throw new NotFoundException("Source deployment not found");
    }

    // Create/update deployment for target environment
    const targetDeployment = await this.prisma.modelDeployment.upsert({
      where: {
        workspaceId_environment_modelId: {
          workspaceId: ctx.workspaceId,
          environment: targetEnvironment,
          modelId: sourceDeployment.modelId,
        },
      },
      update: {
        versionId: sourceDeployment.versionId,
        alias: sourceDeployment.alias,
        createdById: ctx.userId,
        updatedAt: new Date(),
      },
      create: {
        workspaceId: ctx.workspaceId,
        modelId: sourceDeployment.modelId,
        versionId: sourceDeployment.versionId,
        environment: targetEnvironment,
        alias: sourceDeployment.alias,
        createdById: ctx.userId,
      },
    });

    // Audit log
    await this.audit.record(ctx, {
      action: "model.deployment.promoted",
      entityType: "ModelDeployment",
      entityId: targetDeployment.id,
      metadata: {
        fromDeploymentId,
        fromEnvironment: sourceDeployment.environment,
        targetEnvironment,
        versionId: sourceDeployment.versionId,
        modelId: sourceDeployment.modelId,
      },
    });

    // Observability event
    await this.observability.logEvent(ctx, {
      category: "model",
      eventType: "model.deployment.promoted",
      entityId: targetDeployment.id,
      entityType: "deployment",
      success: true,
      metadata: {
        fromDeploymentId,
        fromEnvironment: sourceDeployment.environment,
        targetEnvironment,
        versionId: sourceDeployment.versionId,
      },
    });

    // Billing usage
    try {
      await this.billing.recordUsage(ctx, "model.deployment", 1, 0.002, {
        deploymentId: targetDeployment.id,
        action: "promote",
        targetEnvironment,
      });
    } catch (error: any) {
      this.logger.error(`Failed to record billing for promotion: ${error.message}`);
    }

    return targetDeployment;
  }

  /**
   * Rollback a deployment to a previous version
   */
  async rollbackDeployment(
    ctx: AuthContextData,
    modelId: string,
    environment: 'staging' | 'prod',
    targetVersionId: string
  ): Promise<ModelDeployment> {
    // Check permissions
    if (ctx.membership?.role !== "owner" && ctx.membership?.role !== "admin") {
      throw new ForbiddenException("Only owners and admins can rollback deployments");
    }

    // Validate environment
    if (environment !== 'staging' && environment !== 'prod') {
      throw new BadRequestException("Environment must be 'staging' or 'prod'");
    }

    // Verify model exists
    const model = await this.prisma.model.findFirst({
      where: {
        id: modelId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!model) {
      throw new NotFoundException("Model not found");
    }

    // Verify target version exists and belongs to this model
    const targetVersion = await this.prisma.modelVersion.findFirst({
      where: {
        id: targetVersionId,
        modelId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!targetVersion) {
      throw new NotFoundException("Target version not found or does not belong to this model");
    }

    // Update deployment to point to target version
    const deployment = await this.prisma.modelDeployment.upsert({
      where: {
        workspaceId_environment_modelId: {
          workspaceId: ctx.workspaceId,
          environment,
          modelId,
        },
      },
      update: {
        versionId: targetVersionId,
        createdById: ctx.userId,
        updatedAt: new Date(),
      },
      create: {
        workspaceId: ctx.workspaceId,
        modelId,
        versionId: targetVersionId,
        environment,
        createdById: ctx.userId,
      },
    });

    // Audit log
    await this.audit.record(ctx, {
      action: "model.deployment.rolled_back",
      entityType: "ModelDeployment",
      entityId: deployment.id,
      metadata: {
        modelId,
        environment,
        targetVersionId,
        targetVersion: targetVersion.version,
      },
    });

    // Observability event
    await this.observability.logEvent(ctx, {
      category: "model",
      eventType: "model.deployment.rolled_back",
      entityId: deployment.id,
      entityType: "deployment",
      success: true,
      metadata: {
        modelId,
        environment,
        targetVersionId,
        targetVersion: targetVersion.version,
      },
    });

    // Billing usage
    try {
      await this.billing.recordUsage(ctx, "model.deployment", 1, 0.002, {
        deploymentId: deployment.id,
        action: "rollback",
        environment,
      });
    } catch (error: any) {
      this.logger.error(`Failed to record billing for rollback: ${error.message}`);
    }

    return deployment;
  }
}
