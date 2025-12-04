import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthContextData } from "../context/auth-context.interface";

export interface LogEventData {
  category: string;
  eventType: string;
  entityId?: string;
  entityType?: string;
  durationMs?: number;
  success?: boolean;
  metadata?: any;
}

export interface EventFilters {
  category?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

export interface MetricFilters {
  category: string;
  range: "1d" | "7d" | "30d";
}

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an observability event
   * NEVER throws - errors are logged and suppressed
   */
  async logEvent(ctx: AuthContextData | null, data: LogEventData): Promise<void> {
    try {
      // Determine workspaceId
      const workspaceId = ctx?.workspaceId;
      if (!workspaceId) {
        this.logger.debug("Observability event skipped: no workspaceId");
        return;
      }

      // Create event
      await this.prisma.observabilityEvent.create({
        data: {
          workspaceId,
          category: data.category,
          eventType: data.eventType,
          entityId: data.entityId || null,
          entityType: data.entityType || null,
          durationMs: data.durationMs || null,
          success: data.success !== undefined ? data.success : null,
          metadata: data.metadata || null,
        },
      });

      this.logger.debug(
        `Event logged: ${data.category}.${data.eventType} (workspace: ${workspaceId})`
      );
    } catch (error: any) {
      // NEVER throw - observability failures must not break main flows
      this.logger.warn(
        `Failed to log observability event: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Aggregate a metric delta
   * Creates or updates metric for current 1-hour bucket
   */
  async aggregateMetric(
    workspaceId: string,
    category: string,
    delta: number,
    metadata?: any
  ): Promise<void> {
    try {
      // Get current 1-hour bucket
      const now = new Date();
      const periodStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        0,
        0,
        0
      );
      const periodEnd = new Date(periodStart);
      periodEnd.setHours(periodEnd.getHours() + 1);

      // Find existing metric
      const existing = await this.prisma.observabilityMetric.findFirst({
        where: {
          workspaceId,
          category,
          periodStart,
          periodEnd,
        },
      });

      if (existing) {
        // Update existing
        await this.prisma.observabilityMetric.update({
          where: { id: existing.id },
          data: {
            value: existing.value + delta,
            metadata: metadata || existing.metadata,
          },
        });
      } else {
        // Create new
        await this.prisma.observabilityMetric.create({
          data: {
            workspaceId,
            category,
            periodStart,
            periodEnd,
            value: delta,
            metadata: metadata || null,
          },
        });
      }

      this.logger.debug(
        `Metric aggregated: ${category} (+${delta}) for workspace ${workspaceId}`
      );
    } catch (error: any) {
      this.logger.warn(
        `Failed to aggregate metric: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * List events with filters
   */
  async listEvents(ctx: AuthContextData, filters: EventFilters) {
    const where: any = {
      workspaceId: ctx.workspaceId,
    };

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.from || filters.to) {
      where.timestamp = {};
      if (filters.from) {
        where.timestamp.gte = filters.from;
      }
      if (filters.to) {
        where.timestamp.lte = filters.to;
      }
    }

    const events = await this.prisma.observabilityEvent.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: filters.limit || 100,
    });

    return events;
  }

  /**
   * List metrics with filters
   */
  async listMetrics(ctx: AuthContextData, filters: MetricFilters) {
    // Calculate date range
    const now = new Date();
    const periodStart = new Date(now);

    switch (filters.range) {
      case "1d":
        periodStart.setDate(periodStart.getDate() - 1);
        break;
      case "7d":
        periodStart.setDate(periodStart.getDate() - 7);
        break;
      case "30d":
        periodStart.setDate(periodStart.getDate() - 30);
        break;
    }

    const metrics = await this.prisma.observabilityMetric.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        category: filters.category,
        periodStart: {
          gte: periodStart,
        },
      },
      orderBy: { periodStart: "asc" },
    });

    return metrics;
  }

  /**
   * Prepare correlated trace for an entity
   * Gathers all related events in chronological order
   */
  async prepareCorrelatedTrace(
    ctx: AuthContextData,
    entityType: string,
    entityId: string
  ) {
    // Get all events related to this entity
    const events = await this.prisma.observabilityEvent.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        OR: [
          { entityId, entityType },
          // Also include events that reference this entity in metadata
          {
            metadata: {
              path: ["$." + entityType + "Id"],
              equals: entityId,
            } as any,
          },
        ],
      },
      orderBy: { timestamp: "asc" },
    });

    // Group by category
    const grouped: Record<string, any[]> = {};
    for (const event of events) {
      if (!grouped[event.category]) {
        grouped[event.category] = [];
      }
      grouped[event.category].push(event);
    }

    return {
      entityId,
      entityType,
      events,
      grouped,
      timeline: events.map((e) => ({
        timestamp: e.timestamp,
        category: e.category,
        eventType: e.eventType,
        durationMs: e.durationMs,
        success: e.success,
      })),
    };
  }

  /**
   * Aggregate events into metrics (for cron job)
   * Processes last 15 minutes of events
   */
  async aggregateRecentEvents(): Promise<void> {
    try {
      const now = new Date();
      const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

      // Get all events from last 15 minutes
      const events = await this.prisma.observabilityEvent.findMany({
        where: {
          timestamp: {
            gte: fifteenMinutesAgo,
          },
        },
      });

      this.logger.log(
        `Aggregating ${events.length} events from last 15 minutes`
      );

      // Group by workspace + category
      const aggregates = new Map<
        string,
        { workspaceId: string; category: string; count: number; metadata: any }
      >();

      for (const event of events) {
        const key = `${event.workspaceId}:${event.category}`;
        if (!aggregates.has(key)) {
          aggregates.set(key, {
            workspaceId: event.workspaceId,
            category: event.category,
            count: 0,
            metadata: {},
          });
        }
        const agg = aggregates.get(key)!;
        agg.count++;
      }

      // Create metrics
      for (const agg of aggregates.values()) {
        await this.aggregateMetric(
          agg.workspaceId,
          agg.category,
          agg.count,
          agg.metadata
        );
      }

      this.logger.log(
        `Created ${aggregates.size} metric aggregates`
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to aggregate events: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Clean old events (90 days+)
   */
  async cleanOldEvents(): Promise<void> {
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const result = await this.prisma.observabilityEvent.deleteMany({
        where: {
          timestamp: {
            lt: ninetyDaysAgo,
          },
        },
      });

      this.logger.log(`Cleaned ${result.count} old observability events`);
    } catch (error: any) {
      this.logger.error(
        `Failed to clean old events: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Get summary stats for a workspace
   */
  async getSummaryStats(ctx: AuthContextData, range: "1d" | "7d" | "30d") {
    const now = new Date();
    const periodStart = new Date(now);

    switch (range) {
      case "1d":
        periodStart.setDate(periodStart.getDate() - 1);
        break;
      case "7d":
        periodStart.setDate(periodStart.getDate() - 7);
        break;
      case "30d":
        periodStart.setDate(periodStart.getDate() - 30);
        break;
    }

    // Count events by category
    const eventCounts = await this.prisma.observabilityEvent.groupBy({
      by: ["category"],
      where: {
        workspaceId: ctx.workspaceId,
        timestamp: {
          gte: periodStart,
        },
      },
      _count: {
        id: true,
      },
    });

    // Get metric totals by category
    const metricTotals = await this.prisma.observabilityMetric.groupBy({
      by: ["category"],
      where: {
        workspaceId: ctx.workspaceId,
        periodStart: {
          gte: periodStart,
        },
      },
      _sum: {
        value: true,
      },
    });

    return {
      eventCounts: eventCounts.map((e) => ({
        category: e.category,
        count: e._count.id,
      })),
      metricTotals: metricTotals.map((m) => ({
        category: m.category,
        total: m._sum.value || 0,
      })),
    };
  }
}
