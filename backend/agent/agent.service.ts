import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthContextData } from "../context/auth-context.interface";
import { AgentRegistryService } from "./registry/agent-registry.service";

@Injectable()
export class AgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AgentRegistryService
  ) {}

  async createRun(ctx: AuthContextData, input: any, agentId?: string) {
    // Validate agent if provided
    if (agentId) {
      const agent = await this.registry.getAgent(agentId, ctx.workspaceId);
      if (!agent) {
        throw new Error("Agent not found");
      }
    }

    const run = await this.prisma.agentRun.create({
      data: {
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        agentId,
        input,
        status: "pending",
      },
    });

    await this.prisma.agentMessage.create({
      data: {
        runId: run.id,
        role: "system",
        content: "Run created",
      },
    });

    return run;
  }
}
