import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AgentStateService {
  constructor(private readonly prisma: PrismaService) {}

  async initialize(runId: string) {
    return this.prisma.agentState.create({
      data: {
        runId,
        state: { goals: [], variables: {}, tasks: [] },
      },
    });
  }

  async get(runId: string) {
    return this.prisma.agentState.findUnique({
      where: { runId },
    });
  }

  async update(runId: string, patch: any) {
    const current = await this.get(runId);
    if (!current) throw new Error("State not found");

    const newState = { ...(current.state as any), ...patch };

    return this.prisma.agentState.update({
      where: { runId },
      data: { state: newState as any },
    });
  }

  async replace(runId: string, newState: any) {
    return this.prisma.agentState.update({
      where: { runId },
      data: { state: newState as any },
    });
  }
}
