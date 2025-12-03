import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class StepLoggerService {
  constructor(private readonly prisma: PrismaService) {}

  async logModelStep(runId: string, stepNumber: number, action: string) {
    return this.prisma.agentStep.create({
      data: { runId, stepNumber, type: "model", action },
    });
  }

  async logToolStep(
    runId: string,
    stepNumber: number,
    toolName: string,
    args: any,
    result: any
  ) {
    return this.prisma.agentStep.create({
      data: {
        runId,
        stepNumber,
        type: "tool",
        toolName,
        arguments: args as any,
        result: result as any,
      },
    });
  }
}
