import { Controller, Post, Body, UseGuards, Get, Param, Res } from "@nestjs/common";
import { Response } from "express";
import { AgentService } from "./agent.service";
import { AgentExecutionService } from "./agent-execution.service";
import { ToolRegistryService } from "./tools/tool-registry.service";
import { JobQueueService } from "../jobs/job-queue.service";
import { AuthContext } from "../context/auth-context.decorator";
import { AuthContextGuard } from "../context/auth-context.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { RateLimitGuard } from "../guards/rate-limit.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { RateLimit } from "../rate-limit/rate-limit.decorator";
import { RATE_KEY_AGENT_RUN, RATE_KEY_AGENT_STREAM } from "../rate-limit/rate-limit.service";
import { AuthContextData } from "../context/auth-context.interface";

@Controller("agent")
@UseGuards(AuthContextGuard, PermissionsGuard, RateLimitGuard)
@RequirePermission("workspace.agents")
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly agentExecutionService: AgentExecutionService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly jobQueue: JobQueueService
  ) {}

  @Post("run")
  @RateLimit(RATE_KEY_AGENT_RUN, 60)
  async createRun(
    @AuthContext() ctx: AuthContextData,
    @Body() body: { input: any; agentId?: string }
  ) {
    const run = await this.agentService.createRun(ctx, body.input, body.agentId);

    return {
      success: true,
      runId: run.id,
      status: run.status,
    };
  }

  @Post("execute")
  @RateLimit(RATE_KEY_AGENT_RUN, 60)
  async executeRun(
    @AuthContext() ctx: AuthContextData,
    @Body() body: { runId: string }
  ) {
    const result = await this.agentExecutionService.executeRun(
      ctx,
      body.runId
    );

    return {
      success: true,
      ...result,
    };
  }

  @Get("stream/:runId")
  @RateLimit(RATE_KEY_AGENT_STREAM, 30)
  async streamRun(
    @Param("runId") runId: string,
    @AuthContext() ctx: AuthContextData,
    @Res() res: Response
  ) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      for await (const chunk of this.agentExecutionService.streamRun(ctx, runId)) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error: any) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }

  @Get("tools")
  getTools() {
    return {
      tools: this.toolRegistry.getAllTools().map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    };
  }

  @Post("run-multi")
  @RateLimit(RATE_KEY_AGENT_RUN, 60)
  async runMulti(
    @AuthContext() ctx: AuthContextData,
    @Body() body: { input: any; agentId?: string }
  ) {
    const run = await this.agentService.createRun(ctx, body.input, body.agentId);

    // Enqueue job for background execution
    const jobId = await this.jobQueue.enqueue(
      "agent.run",
      {
        runId: run.id,
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        role: ctx.membership.role,
      },
      ctx.workspaceId
    );

    return {
      success: true,
      runId: run.id,
      jobId,
      status: "queued",
    };
  }
}
