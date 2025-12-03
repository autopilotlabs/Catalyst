import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.service";
import { SearchIndexService } from "../../search/search-index.service";
import { AuthContextData } from "../../context/auth-context.interface";

@Injectable()
export class AgentRegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly searchIndex: SearchIndexService
  ) {}

  async listAgents(workspaceId: string) {
    return this.prisma.agentConfig.findMany({
      where: { workspaceId },
    });
  }

  async getAgent(id: string, workspaceId: string) {
    return this.prisma.agentConfig.findFirst({
      where: { id, workspaceId },
    });
  }

  async createAgent(workspaceId: string, data: any, ctx?: AuthContextData) {
    const agent = await this.prisma.agentConfig.create({
      data: { ...data, workspaceId },
    });

    // Index for search
    const content = `${agent.name}\n${agent.description || ''}\n${agent.systemPrompt}`;
    await this.searchIndex.indexEntity(workspaceId, 'agent', agent.id, content);

    // Audit log
    if (ctx) {
      await this.auditService.logAgentEvent(ctx, {
        action: "agent.config.created",
        entityType: "agent",
        entityId: agent.id,
        metadata: {
          name: agent.name,
          model: agent.model,
        },
      });
    }

    return agent;
  }

  async updateAgent(id: string, workspaceId: string, data: any, ctx?: AuthContextData) {
    const agent = await this.prisma.agentConfig.update({
      where: { id },
      data,
    });

    // Re-index for search
    const content = `${agent.name}\n${agent.description || ''}\n${agent.systemPrompt}`;
    await this.searchIndex.indexEntity(workspaceId, 'agent', agent.id, content);

    // Audit log
    if (ctx) {
      await this.auditService.logAgentEvent(ctx, {
        action: "agent.config.updated",
        entityType: "agent",
        entityId: id,
        metadata: {
          changes: data,
        },
      });
    }

    return agent;
  }

  async deleteAgent(id: string, workspaceId: string, ctx?: AuthContextData) {
    const agent = await this.prisma.agentConfig.delete({
      where: { id },
    });

    // Remove from search index
    await this.searchIndex.removeEntity(workspaceId, 'agent', id);

    // Audit log
    if (ctx) {
      await this.auditService.logAgentEvent(ctx, {
        action: "agent.config.deleted",
        entityType: "agent",
        entityId: id,
        metadata: {
          name: agent.name,
        },
      });
    }

    return agent;
  }
}
