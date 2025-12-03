import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthContextData } from "../context/auth-context.interface";

export interface AuditRecordParams {
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: any;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(
    ctx: AuthContextData | null,
    params: AuditRecordParams
  ): Promise<void> {
    try {
      // Determine workspaceId - MUST always be present
      const workspaceId = ctx?.workspaceId;
      if (!workspaceId) {
        this.logger.warn("Audit log skipped: no workspaceId available");
        return;
      }

      // Determine userId - can be null for system actions
      const userId = ctx?.userId || null;

      // Create audit log entry
      await this.prisma.auditLog.create({
        data: {
          workspaceId,
          userId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId || null,
          metadata: params.metadata || null,
        },
      });

      this.logger.debug(
        `Audit log recorded: ${params.action} (${params.entityType}${
          params.entityId ? `:${params.entityId}` : ""
        })`
      );
    } catch (error: any) {
      // NEVER throw - audit failures must not break main flows
      this.logger.warn(
        `Failed to record audit log: ${error.message}`,
        error.stack
      );
    }
  }

  // Convenience helpers

  async logAgentEvent(
    ctx: AuthContextData | null,
    params: Omit<AuditRecordParams, "entityType"> & { entityType?: string }
  ): Promise<void> {
    await this.record(ctx, {
      ...params,
      entityType: params.entityType || "agent",
    });
  }

  async logWorkflowEvent(
    ctx: AuthContextData | null,
    params: Omit<AuditRecordParams, "entityType"> & { entityType?: string }
  ): Promise<void> {
    await this.record(ctx, {
      ...params,
      entityType: params.entityType || "workflow",
    });
  }

  async logPluginEvent(
    ctx: AuthContextData | null,
    params: Omit<AuditRecordParams, "entityType"> & { entityType?: string }
  ): Promise<void> {
    await this.record(ctx, {
      ...params,
      entityType: params.entityType || "plugin",
    });
  }

  async logScheduleEvent(
    ctx: AuthContextData | null,
    params: Omit<AuditRecordParams, "entityType"> & { entityType?: string }
  ): Promise<void> {
    await this.record(ctx, {
      ...params,
      entityType: params.entityType || "schedule",
    });
  }

  async logEventTrigger(
    ctx: AuthContextData | null,
    params: Omit<AuditRecordParams, "entityType"> & { entityType?: string }
  ): Promise<void> {
    await this.record(ctx, {
      ...params,
      entityType: params.entityType || "event",
    });
  }

  async logMemoryEvent(
    ctx: AuthContextData | null,
    params: Omit<AuditRecordParams, "entityType"> & { entityType?: string }
  ): Promise<void> {
    await this.record(ctx, {
      ...params,
      entityType: params.entityType || "memory",
    });
  }
}
