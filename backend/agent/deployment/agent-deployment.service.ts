import { Injectable, Logger, ForbiddenException, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.service";
import { BillingService } from "../../billing/billing.service";
import { ObservabilityService } from "../../observability/observability.service";
import { AuthContextData } from "../../context/auth-context.interface";
import { AgentDeployment } from "@prisma/client";

type Environment = 'dev' | 'staging' | 'prod';

@Injectable()
export class AgentDeploymentService {
  private readonly logger = new Logger(AgentDeploymentService.name);
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
    agentId: string,
    versionId: string,
    environment: Environment,
    alias?: string
  ): Promise<AgentDeployment> {
    // Check permissions - only owner and admin can create deployments
    if (ctx.membership?.role !== "owner" && ctx.membership?.role !== "admin") {
      throw new ForbiddenException("Only owners and admins can create deployments");
    }

    // Validate environment
    if (!this.VALID_ENVIRONMENTS.includes(environment)) {
      throw new BadRequestException(`Invalid environment. Must be one of: ${this.VALID_ENVIRONMENTS.join(", ")}`);
    }

    // Verify agent exists
    const agent = await this.prisma.agentConfig.findFirst({
      where: {
        id: agentId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!agent) {
      throw new NotFoundException("Agent not found");
    }

    // Verify version exists and belongs to this agent
    const version = await this.prisma.agentVersion.findFirst({
      where: {
        id: versionId,
        agentId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!version) {
      throw new NotFoundException("Version not found or does not belong to this agent");
    }

    // Upsert deployment (replace existing if present)
    const deployment = await this.prisma.agentDeployment.upsert({
      where: {
        workspaceId_environment_agentId: {
          workspaceId: ctx.workspaceId,
          environment,
          agentId,
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
        agentId,
        versionId,
        environment,
        alias,
        createdById: ctx.userId,
      },
    });

    // Audit log
    await this.audit.record(ctx, {
      action: "agent.deployment.created",
      entityType: "AgentDeployment",
      entityId: deployment.id,
      metadata: {
        agentId,
        versionId,
        environment,
        alias,
      },
    });

    // Observability event
    await this.observability.logEvent(ctx, {
      category: "agent",
      eventType: "agent.deployment.created",
      entityId: deployment.id,
      entityType: "deployment",
      success: true,
      metadata: {
        agentId,
        versionId,
        environment,
        alias,
      },
    });

    // Billing usage
    try {
      await this.billing.recordUsage(ctx, "agent.deployment", 1, 0.002, {
        deploymentId: deployment.id,
        agentId,
        environment,
      });
    } catch (error: any) {
      this.logger.error(`Failed to record billing for deployment: ${error.message}`);
    }

    return deployment;
  }

  /**
   * List all deployments for an agent
   */
  async listDeployments(
    ctx: AuthContextData,
    agentId: string
  ): Promise<AgentDeployment[]> {
    // Verify agent exists
    const agent = await this.prisma.agentConfig.findFirst({
      where: {
        id: agentId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!agent) {
      throw new NotFoundException("Agent not found");
    }

    // List deployments
    const deployments = await this.prisma.agentDeployment.findMany({
      where: {
        agentId,
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
  ): Promise<AgentDeployment> {
    const deployment = await this.prisma.agentDeployment.findFirst({
      where: {
        id: deploymentId,
        workspaceId: ctx.workspaceId,
      },
      include: {
        version: true,
        agent: true,
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
    agentId: string,
    environment: Environment
  ): Promise<AgentDeployment | null> {
    // Validate environment
    if (!this.VALID_ENVIRONMENTS.includes(environment)) {
      throw new BadRequestException(`Invalid environment. Must be one of: ${this.VALID_ENVIRONMENTS.join(", ")}`);
    }

    // Verify agent exists
    const agent = await this.prisma.agentConfig.findFirst({
      where: {
        id: agentId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!agent) {
      throw new NotFoundException("Agent not found");
    }

    const deployment = await this.prisma.agentDeployment.findFirst({
      where: {
        agentId,
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
  ): Promise<AgentDeployment> {
    // Check permissions
    if (ctx.membership?.role !== "owner" && ctx.membership?.role !== "admin") {
      throw new ForbiddenException("Only owners and admins can promote deployments");
    }

    // Validate target environment
    if (targetEnvironment !== 'staging' && targetEnvironment !== 'prod') {
      throw new BadRequestException("Target environment must be 'staging' or 'prod'");
    }

    // Load source deployment
    const sourceDeployment = await this.prisma.agentDeployment.findFirst({
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
    const targetDeployment = await this.prisma.agentDeployment.upsert({
      where: {
        workspaceId_environment_agentId: {
          workspaceId: ctx.workspaceId,
          environment: targetEnvironment,
          agentId: sourceDeployment.agentId,
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
        agentId: sourceDeployment.agentId,
        versionId: sourceDeployment.versionId,
        environment: targetEnvironment,
        alias: sourceDeployment.alias,
        createdById: ctx.userId,
      },
    });

    // Audit log
    await this.audit.record(ctx, {
      action: "agent.deployment.promoted",
      entityType: "AgentDeployment",
      entityId: targetDeployment.id,
      metadata: {
        fromDeploymentId,
        fromEnvironment: sourceDeployment.environment,
        targetEnvironment,
        versionId: sourceDeployment.versionId,
        agentId: sourceDeployment.agentId,
      },
    });

    // Observability event
    await this.observability.logEvent(ctx, {
      category: "agent",
      eventType: "agent.deployment.promoted",
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
      await this.billing.recordUsage(ctx, "agent.deployment", 1, 0.002, {
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
    environment: 'staging' | 'prod',
    agentId: string,
    targetVersionId: string
  ): Promise<AgentDeployment> {
    // Check permissions
    if (ctx.membership?.role !== "owner" && ctx.membership?.role !== "admin") {
      throw new ForbiddenException("Only owners and admins can rollback deployments");
    }

    // Validate environment
    if (environment !== 'staging' && environment !== 'prod') {
      throw new BadRequestException("Environment must be 'staging' or 'prod'");
    }

    // Verify agent exists
    const agent = await this.prisma.agentConfig.findFirst({
      where: {
        id: agentId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!agent) {
      throw new NotFoundException("Agent not found");
    }

    // Verify target version exists and belongs to this agent
    const targetVersion = await this.prisma.agentVersion.findFirst({
      where: {
        id: targetVersionId,
        agentId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!targetVersion) {
      throw new NotFoundException("Target version not found or does not belong to this agent");
    }

    // Update deployment to point to target version
    const deployment = await this.prisma.agentDeployment.upsert({
      where: {
        workspaceId_environment_agentId: {
          workspaceId: ctx.workspaceId,
          environment,
          agentId,
        },
      },
      update: {
        versionId: targetVersionId,
        createdById: ctx.userId,
        updatedAt: new Date(),
      },
      create: {
        workspaceId: ctx.workspaceId,
        agentId,
        versionId: targetVersionId,
        environment,
        createdById: ctx.userId,
      },
    });

    // Audit log
    await this.audit.record(ctx, {
      action: "agent.deployment.rolled_back",
      entityType: "AgentDeployment",
      entityId: deployment.id,
      metadata: {
        agentId,
        environment,
        targetVersionId,
        targetVersion: targetVersion.version,
      },
    });

    // Observability event
    await this.observability.logEvent(ctx, {
      category: "agent",
      eventType: "agent.deployment.rolled_back",
      entityId: deployment.id,
      entityType: "deployment",
      success: true,
      metadata: {
        agentId,
        environment,
        targetVersionId,
        targetVersion: targetVersion.version,
      },
    });

    // Billing usage
    try {
      await this.billing.recordUsage(ctx, "agent.deployment", 1, 0.002, {
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
