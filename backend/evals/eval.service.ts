import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { ModelGatewayService } from "../models/model-gateway.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AuditService } from "../audit/audit.service";
import { BillingService } from "../billing/billing.service";
import { AuthContextData } from "../context/auth-context.interface";

export interface CreateSuiteDto {
  name: string;
  description?: string;
}

export interface CreateTestDto {
  name: string;
  input: any;
  expected?: any;
}

@Injectable()
export class EvalService {
  private readonly logger = new Logger(EvalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly modelGateway: ModelGatewayService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly billing: BillingService
  ) {}

  async createSuite(ctx: AuthContextData, dto: CreateSuiteDto) {
    const suite = await this.prisma.evalSuite.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: dto.name,
        description: dto.description,
      },
    });

    this.logger.log(`Created eval suite: ${suite.id} for workspace ${ctx.workspaceId}`);

    return suite;
  }

  async listSuites(ctx: AuthContextData) {
    return this.prisma.evalSuite.findMany({
      where: {
        workspaceId: ctx.workspaceId,
      },
      include: {
        _count: {
          select: {
            tests: true,
            runs: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async getSuite(ctx: AuthContextData, suiteId: string) {
    const suite = await this.prisma.evalSuite.findFirst({
      where: {
        id: suiteId,
        workspaceId: ctx.workspaceId,
      },
      include: {
        _count: {
          select: {
            tests: true,
            runs: true,
          },
        },
      },
    });

    if (!suite) {
      throw new NotFoundException(`Suite not found: ${suiteId}`);
    }

    return suite;
  }

  async createTest(ctx: AuthContextData, suiteId: string, dto: CreateTestDto) {
    // Verify suite exists and belongs to workspace
    await this.getSuite(ctx, suiteId);

    const test = await this.prisma.evalTest.create({
      data: {
        workspaceId: ctx.workspaceId,
        suiteId,
        name: dto.name,
        input: dto.input,
        expected: dto.expected,
      },
    });

    this.logger.log(`Created eval test: ${test.id} for suite ${suiteId}`);

    return test;
  }

  async listTests(ctx: AuthContextData, suiteId: string) {
    // Verify suite exists and belongs to workspace
    await this.getSuite(ctx, suiteId);

    return this.prisma.evalTest.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        suiteId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async startEvalRun(ctx: AuthContextData, suiteId: string, modelId: string) {
    // Verify suite exists
    const suite = await this.getSuite(ctx, suiteId);

    // Count tests
    const testCount = await this.prisma.evalTest.count({
      where: {
        workspaceId: ctx.workspaceId,
        suiteId,
      },
    });

    // Create run
    const run = await this.prisma.evalRun.create({
      data: {
        workspaceId: ctx.workspaceId,
        suiteId,
        modelId,
        status: "pending",
        totalTests: testCount,
      },
    });

    this.logger.log(`Started eval run: ${run.id} for suite ${suiteId}`);

    return run;
  }

  async processEvalRun(payload: {
    suiteId: string;
    modelId: string;
    runId: string;
    workspaceId: string;
    userId: string;
    role: string;
  }) {
    const ctx: AuthContextData = {
      userId: payload.userId,
      workspaceId: payload.workspaceId,
      membership: {
        role: payload.role as 'owner' | 'admin' | 'member' | 'viewer',
      },
    };

    try {
      // Update status to running
      await this.prisma.evalRun.update({
        where: { id: payload.runId },
        data: { status: "running" },
      });

      // Load all tests
      const tests = await this.prisma.evalTest.findMany({
        where: {
          workspaceId: payload.workspaceId,
          suiteId: payload.suiteId,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      let passedCount = 0;
      let failedCount = 0;

      // Execute each test
      for (const test of tests) {
        const startTime = Date.now();
        let passed = false;
        let actual: any = null;
        let error: string | undefined;

        try {
          // Invoke model
          let messages: any[];
          if (Array.isArray(test.input)) {
            messages = test.input;
          } else {
            messages = [{ role: "user", content: JSON.stringify(test.input) }];
          }

          const result = await this.modelGateway.invokeChat(ctx, {
            modelId: payload.modelId,
            messages: messages as any,
          });

          actual = { content: result.content, usage: result.usage };

          // Compare result to expected (simple exact match for now)
          if (test.expected) {
            const expectedStr = JSON.stringify(test.expected);
            const actualStr = JSON.stringify(actual.content);
            passed = expectedStr === actualStr;
          } else {
            // If no expected value, just check for non-error
            passed = true;
          }

          if (passed) {
            passedCount++;
          } else {
            failedCount++;
          }
        } catch (err: any) {
          error = err.message || "Unknown error";
          failedCount++;
          this.logger.error(`Test ${test.id} failed: ${error}`);
        }

        const durationMs = Date.now() - startTime;

        // Create result
        await this.prisma.evalResult.create({
          data: {
            workspaceId: payload.workspaceId,
            runId: payload.runId,
            testId: test.id,
            actual: actual || {},
            expected: test.expected || {},
            passed,
            error,
            durationMs,
          },
        });
      }

      // Update run with final stats
      const updatedRun = await this.prisma.evalRun.update({
        where: { id: payload.runId },
        data: {
          status: "success",
          passedTests: passedCount,
          failedTests: failedCount,
          completedAt: new Date(),
        },
      });

      // Check for regression against baseline
      const baseline = await this.getBaselineForSuiteModel(
        payload.workspaceId,
        payload.suiteId,
        payload.modelId
      );

      let regression = false;
      let regressionDelta: number | null = null;
      let baselineRunId: string | null = null;

      const passRate = this.computePassRate({
        passed: passedCount,
        failed: failedCount,
      });

      if (baseline?.run) {
        const baselinePassRate = this.computePassRate({
          passed: baseline.run.passedTests,
          failed: baseline.run.failedTests,
        });
        regressionDelta = baselinePassRate - passRate;
        baselineRunId = baseline.run.id;
        regression = regressionDelta >= 0.05; // 5% drop threshold
      }

      // Update run with regression data
      await this.prisma.evalRun.update({
        where: { id: payload.runId },
        data: {
          regression,
          regressionDelta,
          baselineRunId,
        },
      });

      // Emit analytics event
      await this.analytics.recordEvent(ctx, "eval.run.completed", {
        runId: payload.runId,
        suiteId: payload.suiteId,
        modelId: payload.modelId,
        totalTests: tests.length,
        passedTests: passedCount,
        failedTests: failedCount,
        passRate,
        regression,
        regressionDelta,
        baselineRunId,
      });

      // Record billing usage for eval run
      const evalCostPerTest = 0.0002;
      const evalCost = tests.length * evalCostPerTest;
      try {
        await this.billing.recordUsage(ctx, "eval.run", tests.length, evalCost, {
          suiteId: payload.suiteId,
          modelId: payload.modelId,
          runId: payload.runId,
        });
      } catch (billingError: any) {
        this.logger.error(`Failed to record eval billing: ${billingError.message}`);
      }

      // Regression notification + audit
      if (regression && baselineRunId) {
        try {
          await this.notifications.sendToWorkspace(
            payload.workspaceId,
            "eval.regression",
            "Eval Regression Detected",
            `Suite regressed for model ${payload.modelId}. Pass rate dropped by ${(regressionDelta! * 100).toFixed(1)} points.`,
            {
              runId: payload.runId,
              baselineRunId,
              regressionDelta,
              passRate,
              suiteId: payload.suiteId,
              modelId: payload.modelId,
            }
          );

          await this.audit.record(ctx, {
            action: "eval.regression.detected",
            entityType: "EvalRun",
            entityId: payload.runId,
            metadata: {
              baselineRunId,
              regressionDelta,
              passRate,
            },
          });
        } catch (notifError: any) {
          this.logger.error(
            `Failed to send regression notification: ${notifError.message}`
          );
        }
      }

      this.logger.log(
        `Eval run ${payload.runId} completed: ${passedCount}/${tests.length} passed`
      );
    } catch (error: any) {
      // Update run status to failed
      await this.prisma.evalRun.update({
        where: { id: payload.runId },
        data: {
          status: "failed",
          completedAt: new Date(),
        },
      });

      this.logger.error(`Eval run ${payload.runId} failed: ${error.message}`);
      throw error;
    }
  }

  private computePassRate(run: { passed: number; failed: number }): number {
    const total = run.passed + run.failed;
    if (total === 0) return 0;
    return run.passed / total;
  }

  async getBaselineForSuiteModel(
    workspaceId: string,
    suiteId: string,
    modelId: string
  ) {
    return this.prisma.evalBaseline.findFirst({
      where: { workspaceId, suiteId, modelId },
      include: { run: true },
    });
  }

  async setBaselineRun(ctx: AuthContextData, runId: string) {
    const run = await this.prisma.evalRun.findFirst({
      where: {
        id: runId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!run) {
      throw new NotFoundException("Eval run not found");
    }

    const baseline = await this.prisma.evalBaseline.upsert({
      where: {
        workspaceId_suiteId_modelId: {
          workspaceId: ctx.workspaceId,
          suiteId: run.suiteId,
          modelId: run.modelId,
        },
      },
      create: {
        workspaceId: ctx.workspaceId,
        suiteId: run.suiteId,
        modelId: run.modelId,
        runId: run.id,
      },
      update: {
        runId: run.id,
      },
    });

    await this.audit.record(ctx, {
      action: "eval.baseline.set",
      entityType: "EvalRun",
      entityId: run.id,
      metadata: {
        suiteId: run.suiteId,
        modelId: run.modelId,
        baselineId: baseline.id,
      },
    });

    return baseline;
  }

  async compareRunToBaseline(ctx: AuthContextData, runId: string) {
    const run = await this.prisma.evalRun.findFirst({
      where: { id: runId, workspaceId: ctx.workspaceId },
    });

    if (!run) {
      throw new NotFoundException("Eval run not found");
    }

    const baseline = await this.getBaselineForSuiteModel(
      ctx.workspaceId,
      run.suiteId,
      run.modelId
    );

    const passRate = this.computePassRate({
      passed: run.passedTests,
      failed: run.failedTests,
    });

    let baselinePassRate: number | null = null;
    let regression = false;
    let regressionDelta: number | null = null;

    if (baseline?.run) {
      baselinePassRate = this.computePassRate({
        passed: baseline.run.passedTests,
        failed: baseline.run.failedTests,
      });
      regressionDelta = baselinePassRate - passRate;
      regression = regressionDelta >= 0.05;
    }

    return {
      run,
      baseline: baseline?.run ?? null,
      passRate,
      baselinePassRate,
      regression,
      regressionDelta,
    };
  }

  async listRuns(ctx: AuthContextData, suiteId?: string) {
    return this.prisma.evalRun.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        ...(suiteId && { suiteId }),
      },
      include: {
        suite: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });
  }

  async getRun(ctx: AuthContextData, runId: string) {
    const run = await this.prisma.evalRun.findFirst({
      where: {
        id: runId,
        workspaceId: ctx.workspaceId,
      },
      include: {
        suite: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        results: {
          include: {
            test: {
              select: {
                id: true,
                name: true,
                input: true,
                expected: true,
              },
            },
          },
          orderBy: {
            test: {
              createdAt: "asc",
            },
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException(`Run not found: ${runId}`);
    }

    return run;
  }
}
