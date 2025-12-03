import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthContextData } from "../context/auth-context.interface";

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordEvent(
    ctx: AuthContextData,
    type: string,
    context: any
  ): Promise<void> {
    try {
      // Insert analytics event
      await this.prisma.analyticsEvent.create({
        data: {
          workspaceId: ctx.workspaceId,
          userId: ctx.userId,
          type,
          context,
        },
      });

      // Update daily usage aggregates
      await this.updateDailyUsage(ctx.workspaceId, type, context);

      this.logger.debug(`Recorded analytics event: ${type} for workspace ${ctx.workspaceId}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to record analytics event: ${error.message}`,
        error.stack
      );
      // Don't throw - analytics failures shouldn't break the main flow
    }
  }

  private async updateDailyUsage(
    workspaceId: string,
    type: string,
    context: any
  ): Promise<void> {
    // Get today's date at midnight UTC
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Determine what to increment
    let runsIncrement = 0;
    let workflowsIncrement = 0;
    let tokensIncrement = 0;
    let costIncrement = 0;

    if (type === "run.completed") {
      runsIncrement = 1;
      if (context.tokens) {
        tokensIncrement = context.tokens;
        // Estimate cost: $0.15 per 1M input tokens, $0.60 per 1M output tokens
        // Average: $0.375 per 1M tokens = $0.000000375 per token
        costIncrement = context.tokens * 0.000000375;
      }
    } else if (type === "workflow.triggered") {
      workflowsIncrement = 1;
    }

    // Upsert daily usage record
    try {
      await this.prisma.dailyUsage.upsert({
        where: {
          workspaceId_date: {
            workspaceId,
            date: today,
          },
        },
        update: {
          runs: { increment: runsIncrement },
          workflows: { increment: workflowsIncrement },
          tokens: { increment: tokensIncrement },
          cost: { increment: costIncrement },
        },
        create: {
          workspaceId,
          date: today,
          runs: runsIncrement,
          workflows: workflowsIncrement,
          tokens: tokensIncrement,
          cost: costIncrement,
        },
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to update daily usage: ${error.message}`,
        error.stack
      );
    }
  }

  async getSummary(workspaceId: string) {
    // Get last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setUTCHours(0, 0, 0, 0);

    const dailyUsage = await this.prisma.dailyUsage.findMany({
      where: {
        workspaceId,
        date: {
          gte: thirtyDaysAgo,
        },
      },
    });

    const summary = dailyUsage.reduce(
      (acc, day) => ({
        totalRuns: acc.totalRuns + day.runs,
        totalWorkflows: acc.totalWorkflows + day.workflows,
        totalTokens: acc.totalTokens + day.tokens,
        totalCost: acc.totalCost + day.cost,
      }),
      { totalRuns: 0, totalWorkflows: 0, totalTokens: 0, totalCost: 0 }
    );

    return summary;
  }

  async getTimeSeries(workspaceId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setUTCHours(0, 0, 0, 0);

    const dailyUsage = await this.prisma.dailyUsage.findMany({
      where: {
        workspaceId,
        date: {
          gte: startDate,
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    return dailyUsage.map((day) => ({
      date: day.date.toISOString().split("T")[0],
      runs: day.runs,
      workflows: day.workflows,
      tokens: day.tokens,
      cost: day.cost,
    }));
  }

  async getTopAgents(workspaceId: string, limit: number = 10) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get all completed runs in the last 30 days
    const runs = await this.prisma.agentRun.findMany({
      where: {
        workspaceId,
        status: "completed",
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Group by agent and aggregate
    const agentStats = new Map<string, any>();

    for (const run of runs) {
      if (!run.agentId) continue;

      const key = run.agentId;
      if (!agentStats.has(key)) {
        agentStats.set(key, {
          agentId: run.agentId,
          agentName: run.agent?.name || "Unknown",
          runs: 0,
          tokens: 0,
          cost: 0,
        });
      }

      const stats = agentStats.get(key);
      stats.runs += 1;

      // Extract tokens from context if available
      // We'll need to get this from analytics events
    }

    // Get analytics events for token counts
    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        workspaceId,
        type: "run.completed",
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    });

    for (const event of events) {
      const context = event.context as any;
      if (context.agentId && context.tokens) {
        const stats = agentStats.get(context.agentId);
        if (stats) {
          stats.tokens += context.tokens;
          stats.cost += context.tokens * 0.000000375;
        }
      }
    }

    // Convert to array and sort by runs
    const topAgents = Array.from(agentStats.values())
      .sort((a, b) => b.runs - a.runs)
      .slice(0, limit);

    return topAgents;
  }

  async getTopWorkflows(workspaceId: string, limit: number = 10) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get workflow trigger events
    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        workspaceId,
        type: "workflow.triggered",
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    });

    // Group by workflow
    const workflowStats = new Map<string, any>();

    for (const event of events) {
      const context = event.context as any;
      const workflowId = context.workflowId;

      if (!workflowId) continue;

      if (!workflowStats.has(workflowId)) {
        workflowStats.set(workflowId, {
          workflowId,
          workflowName: context.workflowName || "Unknown",
          triggers: 0,
        });
      }

      const stats = workflowStats.get(workflowId);
      stats.triggers += 1;
    }

    // Enrich with workflow names
    const workflowIds = Array.from(workflowStats.keys());
    const workflows = await this.prisma.workflow.findMany({
      where: {
        id: { in: workflowIds },
        workspaceId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    for (const workflow of workflows) {
      const stats = workflowStats.get(workflow.id);
      if (stats) {
        stats.workflowName = workflow.name;
      }
    }

    // Convert to array and sort
    const topWorkflows = Array.from(workflowStats.values())
      .sort((a, b) => b.triggers - a.triggers)
      .slice(0, limit);

    return topWorkflows;
  }

  async getRecentActivity(workspaceId: string, limit: number = 50) {
    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        workspaceId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return events.map((event) => ({
      id: event.id,
      type: event.type,
      context: event.context,
      createdAt: event.createdAt,
      user: event.user
        ? {
            id: event.user.id,
            email: event.user.email,
            name: `${event.user.firstName || ""} ${event.user.lastName || ""}`.trim() || event.user.email,
          }
        : null,
    }));
  }
}
