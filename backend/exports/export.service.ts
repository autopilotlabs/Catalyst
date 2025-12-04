import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { BillingService } from "../billing/billing.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AuthContextData } from "../context/auth-context.interface";
import * as fs from "fs";
import * as path from "path";
import { createWriteStream } from "fs";

export type ExportType =
  | "agents"
  | "workflows"
  | "runs"
  | "memory"
  | "audit"
  | "billing"
  | "evals";

export type ExportFormat = "csv" | "json" | "zip";

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);
  private readonly exportsDir = path.join(process.cwd(), "backend", "exports");

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
    private readonly notifications: NotificationsService
  ) {
    // Ensure exports directory exists
    if (!fs.existsSync(this.exportsDir)) {
      fs.mkdirSync(this.exportsDir, { recursive: true });
    }
  }

  /**
   * Create an export request and enqueue background job
   */
  async createExport(
    ctx: AuthContextData,
    type: ExportType,
    format: ExportFormat
  ) {
    // Create export request
    const exportRequest = await this.prisma.exportRequest.create({
      data: {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        type,
        format,
        status: "pending",
      },
    });

    this.logger.log(
      `Export request created: ${exportRequest.id} (type: ${type}, format: ${format})`
    );

    // Audit log
    await this.audit.record(ctx, {
      action: "export.requested",
      entityType: "ExportRequest",
      entityId: exportRequest.id,
      metadata: { type, format },
    });

    // Record billing usage
    await this.billing.recordUsage(ctx, "export", 1, 0.001);

    return exportRequest;
  }

  /**
   * Run export job (called by job queue)
   */
  async runExportJob(exportId: string) {
    try {
      this.logger.log(`Starting export job: ${exportId}`);

      // Get export request
      const exportRequest = await this.prisma.exportRequest.findUnique({
        where: { id: exportId },
      });

      if (!exportRequest) {
        throw new Error(`Export request ${exportId} not found`);
      }

      // Update status to running
      await this.prisma.exportRequest.update({
        where: { id: exportId },
        data: { status: "running", updatedAt: new Date() },
      });

      // Create workspace directory
      const workspaceDir = path.join(
        this.exportsDir,
        exportRequest.workspaceId
      );
      if (!fs.existsSync(workspaceDir)) {
        fs.mkdirSync(workspaceDir, { recursive: true });
      }

      // Generate file based on type and format
      const filePath = await this.generateExportFile(
        exportRequest.workspaceId,
        exportRequest.type as ExportType,
        exportRequest.format as ExportFormat,
        exportRequest.id
      );

      // Update export request with success
      await this.prisma.exportRequest.update({
        where: { id: exportId },
        data: {
          status: "success",
          filePath,
          updatedAt: new Date(),
        },
      });

      // Audit log
      const ctx: AuthContextData = {
        userId: exportRequest.userId || "system",
        workspaceId: exportRequest.workspaceId,
        membership: {
          role: "owner",
        },
      };

      await this.audit.record(ctx, {
        action: "export.completed",
        entityType: "ExportRequest",
        entityId: exportRequest.id,
        metadata: {
          type: exportRequest.type,
          format: exportRequest.format,
          filePath,
        },
      });

      // Send notification
      await this.notifications.sendToWorkspace(
        exportRequest.workspaceId,
        "export.ready",
        "Export Ready",
        `Your ${exportRequest.type} export is ready for download.`,
        { exportId: exportRequest.id }
      );

      this.logger.log(`Export job completed: ${exportId}`);
    } catch (error: any) {
      this.logger.error(
        `Export job failed: ${exportId} - ${error.message}`,
        error.stack
      );
      await this.onExportError(exportId, error);
      throw error;
    }
  }

  /**
   * Handle export error
   */
  private async onExportError(exportId: string, error: Error) {
    try {
      const exportRequest = await this.prisma.exportRequest.findUnique({
        where: { id: exportId },
      });

      if (!exportRequest) return;

      await this.prisma.exportRequest.update({
        where: { id: exportId },
        data: {
          status: "error",
          error: error.message,
          updatedAt: new Date(),
        },
      });

      // Audit log
      const ctx: AuthContextData = {
        userId: exportRequest.userId || "system",
        workspaceId: exportRequest.workspaceId,
        membership: {
          role: "owner",
        },
      };

      await this.audit.record(ctx, {
        action: "export.failed",
        entityType: "ExportRequest",
        entityId: exportRequest.id,
        metadata: {
          type: exportRequest.type,
          format: exportRequest.format,
          error: error.message,
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to handle export error: ${err.message}`);
    }
  }

  /**
   * Generate export file
   */
  private async generateExportFile(
    workspaceId: string,
    type: ExportType,
    format: ExportFormat,
    exportId: string
  ): Promise<string> {
    const fileName = `${exportId}.${format}`;
    const filePath = path.join(this.exportsDir, workspaceId, fileName);

    switch (format) {
      case "csv":
        await this.generateCSV(workspaceId, type, filePath);
        break;
      case "json":
        await this.generateJSON(workspaceId, type, filePath);
        break;
      case "zip":
        // For now, generate JSON (in production, would create ZIP)
        await this.generateJSON(workspaceId, type, filePath);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    return filePath;
  }

  /**
   * Generate CSV export
   */
  private async generateCSV(
    workspaceId: string,
    type: ExportType,
    filePath: string
  ) {
    const writeStream = createWriteStream(filePath);

    try {
      const data = await this.fetchDataForExport(workspaceId, type);

      if (data.length === 0) {
        writeStream.write("No data available\n");
        writeStream.end();
        return;
      }

      // Write CSV header
      const headers = Object.keys(data[0]);
      writeStream.write(headers.join(",") + "\n");

      // Write CSV rows
      for (const row of data) {
        const values = headers.map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return "";
          if (typeof val === "string" && val.includes(",")) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return String(val);
        });
        writeStream.write(values.join(",") + "\n");
      }

      writeStream.end();
    } catch (error) {
      writeStream.end();
      throw error;
    }
  }

  /**
   * Generate JSON export
   */
  private async generateJSON(
    workspaceId: string,
    type: ExportType,
    filePath: string
  ) {
    const data = await this.fetchDataForExport(workspaceId, type);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  /**
   * Fetch data for export based on type
   */
  private async fetchDataForExport(
    workspaceId: string,
    type: ExportType
  ): Promise<any[]> {
    switch (type) {
      case "agents":
        return this.exportAgents(workspaceId);
      case "workflows":
        return this.exportWorkflows(workspaceId);
      case "runs":
        return this.exportRuns(workspaceId);
      case "memory":
        return this.exportMemory(workspaceId);
      case "audit":
        return this.exportAudit(workspaceId);
      case "billing":
        return this.exportBilling(workspaceId);
      case "evals":
        return this.exportEvals(workspaceId);
      default:
        throw new Error(`Unsupported export type: ${type}`);
    }
  }

  private async exportAgents(workspaceId: string) {
    const agents = await this.prisma.agentConfig.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        description: true,
        systemPrompt: true,
        model: true,
        maxSteps: true,
        temperature: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return agents.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description || "",
      model: a.model,
      maxSteps: a.maxSteps,
      temperature: a.temperature,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));
  }

  private async exportWorkflows(workspaceId: string) {
    const workflows = await this.prisma.workflow.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        description: true,
        triggerType: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { steps: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return workflows.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description || "",
      triggerType: w.triggerType,
      enabled: w.enabled,
      stepCount: w._count.steps,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    }));
  }

  private async exportRuns(workspaceId: string) {
    const runs = await this.prisma.agentRun.findMany({
      where: { workspaceId },
      select: {
        id: true,
        status: true,
        output: true,
        createdAt: true,
        updatedAt: true,
        agent: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10000, // Limit to recent 10k runs
    });

    return runs.map((r) => ({
      id: r.id,
      agentName: r.agent?.name || "Unknown",
      status: r.status,
      output: r.output || "",
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  private async exportMemory(workspaceId: string) {
    const memories = await this.prisma.agentMemory.findMany({
      where: { workspaceId },
      select: {
        id: true,
        content: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });

    return memories.map((m) => ({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  private async exportAudit(workspaceId: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: { workspaceId },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });

    return logs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId || "",
      userEmail: l.user?.email || "System",
      createdAt: l.createdAt.toISOString(),
    }));
  }

  private async exportBilling(workspaceId: string) {
    const cycles = await this.prisma.billingCycle.findMany({
      where: { workspaceId },
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        totalCost: true,
        closed: true,
        createdAt: true,
      },
      orderBy: { periodStart: "desc" },
    });

    return cycles.map((c) => ({
      id: c.id,
      periodStart: c.periodStart.toISOString(),
      periodEnd: c.periodEnd.toISOString(),
      totalCost: c.totalCost,
      closed: c.closed,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  private async exportEvals(workspaceId: string) {
    const runs = await this.prisma.evalRun.findMany({
      where: { workspaceId },
      select: {
        id: true,
        status: true,
        totalTests: true,
        passedTests: true,
        failedTests: true,
        createdAt: true,
        completedAt: true,
        suite: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });

    return runs.map((r) => ({
      id: r.id,
      suiteName: r.suite?.name || "Unknown",
      status: r.status,
      totalTests: r.totalTests,
      passedTests: r.passedTests,
      failedTests: r.failedTests,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() || "",
    }));
  }

  /**
   * List export requests for a workspace
   */
  async listExports(workspaceId: string) {
    return this.prisma.exportRequest.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  /**
   * Get export request by ID
   */
  async getExport(exportId: string, workspaceId: string) {
    return this.prisma.exportRequest.findFirst({
      where: {
        id: exportId,
        workspaceId,
      },
    });
  }
}
