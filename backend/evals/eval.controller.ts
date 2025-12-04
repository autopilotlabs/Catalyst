import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthContextGuard } from "../context/auth-context.guard";
import { SubscriptionGuard } from "../guards/subscription.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { RateLimitGuard } from "../guards/rate-limit.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { RateLimit } from "../rate-limit/rate-limit.decorator";
import { AuthContext } from "../context/auth-context.decorator";
import { AuthContextData } from "../context/auth-context.interface";
import { EvalService, CreateSuiteDto, CreateTestDto } from "./eval.service";
import { JobQueueService } from "../jobs/job-queue.service";
import { AuditService } from "../audit/audit.service";

@Controller("eval")
@UseGuards(AuthContextGuard, SubscriptionGuard, PermissionsGuard, RateLimitGuard)
@RequirePermission("workspace.agents")
export class EvalController {
  constructor(
    private readonly evalService: EvalService,
    private readonly jobQueue: JobQueueService,
    private readonly audit: AuditService
  ) {}

  @Post("suites")
  @RateLimit("eval.suite", 60)
  async createSuite(
    @AuthContext() ctx: AuthContextData,
    @Body() dto: CreateSuiteDto
  ) {
    await this.audit.record(ctx, {
      action: "eval.suite.create",
      entityType: "eval_suite",
      metadata: { name: dto.name },
    });

    const suite = await this.evalService.createSuite(ctx, dto);
    return { data: suite };
  }

  @Get("suites")
  @RateLimit("eval.suite", 60)
  async listSuites(@AuthContext() ctx: AuthContextData) {
    const suites = await this.evalService.listSuites(ctx);
    return { data: suites };
  }

  @Get("suites/:suiteId")
  @RateLimit("eval.suite", 60)
  async getSuite(
    @AuthContext() ctx: AuthContextData,
    @Param("suiteId") suiteId: string
  ) {
    const suite = await this.evalService.getSuite(ctx, suiteId);
    return { data: suite };
  }

  @Post("suites/:suiteId/tests")
  @RateLimit("eval.test", 120)
  async createTest(
    @AuthContext() ctx: AuthContextData,
    @Param("suiteId") suiteId: string,
    @Body() dto: CreateTestDto
  ) {
    await this.audit.record(ctx, {
      action: "eval.test.create",
      entityType: "eval_test",
      entityId: suiteId,
      metadata: { name: dto.name },
    });

    const test = await this.evalService.createTest(ctx, suiteId, dto);
    return { data: test };
  }

  @Get("suites/:suiteId/tests")
  @RateLimit("eval.test", 120)
  async listTests(
    @AuthContext() ctx: AuthContextData,
    @Param("suiteId") suiteId: string
  ) {
    const tests = await this.evalService.listTests(ctx, suiteId);
    return { data: tests };
  }

  @Post("suites/:suiteId/run")
  @RateLimit("eval.run", 30)
  async runEval(
    @AuthContext() ctx: AuthContextData,
    @Param("suiteId") suiteId: string,
    @Body() body: { modelId: string }
  ) {
    await this.audit.record(ctx, {
      action: "eval.run.start",
      entityType: "eval_run",
      entityId: suiteId,
      metadata: { modelId: body.modelId },
    });

    const run = await this.evalService.startEvalRun(
      ctx,
      suiteId,
      body.modelId
    );

    // Enqueue job
    const jobId = await this.jobQueue.enqueue(
      "eval.run",
      {
        suiteId,
        modelId: body.modelId,
        runId: run.id,
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        role: ctx.membership.role,
      },
      ctx.workspaceId
    );

    return { data: { runId: run.id, jobId } };
  }

  @Get("runs")
  @RateLimit("eval.run", 30)
  async listRuns(
    @AuthContext() ctx: AuthContextData,
    @Query("suiteId") suiteId?: string
  ) {
    const runs = await this.evalService.listRuns(ctx, suiteId);
    return { data: runs };
  }

  @Get("runs/:runId")
  @RateLimit("eval.run", 30)
  async getRun(
    @AuthContext() ctx: AuthContextData,
    @Param("runId") runId: string
  ) {
    const run = await this.evalService.getRun(ctx, runId);
    return { data: run };
  }

  @Post("runs/:runId/baseline")
  @RateLimit("eval.baseline", 30)
  async setBaseline(
    @AuthContext() ctx: AuthContextData,
    @Param("runId") runId: string
  ) {
    const baseline = await this.evalService.setBaselineRun(ctx, runId);
    return { data: baseline };
  }

  @Get("runs/:runId/compare")
  @RateLimit("eval.compare", 60)
  async compareRun(
    @AuthContext() ctx: AuthContextData,
    @Param("runId") runId: string
  ) {
    const comparison = await this.evalService.compareRunToBaseline(ctx, runId);
    return { data: comparison };
  }
}
