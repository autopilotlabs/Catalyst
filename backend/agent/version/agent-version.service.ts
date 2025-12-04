import { Injectable, Logger, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.service";
import { BillingService } from "../../billing/billing.service";
import { ObservabilityService } from "../../observability/observability.service";
import { AuthContextData } from "../../context/auth-context.interface";
import { AgentVersion } from "@prisma/client";

@Injectable()
export class AgentVersionService {
  private readonly logger = new Logger(AgentVersionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
    private readonly observability: ObservabilityService
  ) {}

  /**
   * Create a new version from current agent config
   */
  async createVersionFromAgent(
    ctx: AuthContextData,
    agentId: string,
    label?: string
  ): Promise<AgentVersion> {
    // Check permissions - only owner and admin can create versions
    if (ctx.membership?.role !== "owner" && ctx.membership?.role !== "admin") {
      throw new ForbiddenException("Only owners and admins can create agent versions");
    }

    // Fetch the agent
    const agent = await this.prisma.agentConfig.findFirst({
      where: {
        id: agentId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!agent) {
      throw new NotFoundException("Agent not found");
    }

    // Get current version count for this agent
    const versionCount = await this.prisma.agentVersion.count({
      where: { agentId },
    });

    const nextVersion = versionCount + 1;

    // Build config snapshot
    const configSnapshot = {
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      maxSteps: agent.maxSteps,
      model: agent.model,
      temperature: agent.temperature,
      topP: agent.topP,
      tools: agent.tools,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    };

    // Create version
    const version = await this.prisma.agentVersion.create({
      data: {
        workspaceId: ctx.workspaceId,
        agentId,
        version: nextVersion,
        label: label || `v${nextVersion}`,
        config: configSnapshot as any,
        createdById: ctx.userId,
      },
    });

    // Audit log
    await this.audit.record(ctx, {
      action: "agent.version.created",
      entityType: "AgentVersion",
      entityId: version.id,
      metadata: {
        agentId,
        version: nextVersion,
        label: version.label,
      },
    });

    // Observability event
    await this.observability.logEvent(ctx, {
      category: "agent",
      eventType: "agent.version.created",
      entityId: version.id,
      entityType: "version",
      success: true,
      metadata: {
        agentId,
        version: nextVersion,
        label: version.label,
      },
    });

    // Billing usage
    try {
      await this.billing.recordUsage(ctx, "agent.version", 1, 0.001, {
        versionId: version.id,
        agentId,
      });
    } catch (error: any) {
      this.logger.error(`Failed to record billing for version creation: ${error.message}`);
    }

    return version;
  }

  /**
   * List all versions for an agent
   */
  async listVersions(
    ctx: AuthContextData,
    agentId: string
  ): Promise<AgentVersion[]> {
    // Verify agent exists and user has access
    const agent = await this.prisma.agentConfig.findFirst({
      where: {
        id: agentId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!agent) {
      throw new NotFoundException("Agent not found");
    }

    // List versions
    const versions = await this.prisma.agentVersion.findMany({
      where: {
        agentId,
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
  ): Promise<AgentVersion> {
    const version = await this.prisma.agentVersion.findFirst({
      where: {
        id: versionId,
        workspaceId: ctx.workspaceId,
      },
      include: {
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

    if (!version) {
      throw new NotFoundException("Version not found");
    }

    return version;
  }

  /**
   * Get the latest version for an agent
   */
  async getLatestVersion(
    ctx: AuthContextData,
    agentId: string
  ): Promise<AgentVersion | null> {
    // Verify agent exists and user has access
    const agent = await this.prisma.agentConfig.findFirst({
      where: {
        id: agentId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!agent) {
      throw new NotFoundException("Agent not found");
    }

    const version = await this.prisma.agentVersion.findFirst({
      where: {
        agentId,
        workspaceId: ctx.workspaceId,
      },
      orderBy: {
        version: "desc",
      },
    });

    return version;
  }
}
