import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { BillingService } from "../billing/billing.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AuthContextData } from "../context/auth-context.interface";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

export type ImportType =
  | "agents"
  | "workflows"
  | "memory"
  | "triggers"
  | "evals";

export type ImportFormat = "csv" | "json";

interface ImportRow {
  rowNumber: number;
  data: any;
}

interface ImportError {
  rowNumber: number;
  data: any;
  error: string;
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);
  private readonly uploadsDir = path.join(process.cwd(), "backend", "uploads");

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
    private readonly notifications: NotificationsService
  ) {
    // Ensure uploads directory exists
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Create an import request and enqueue background job
   */
  async createImport(
    ctx: AuthContextData,
    type: ImportType,
    format: ImportFormat,
    filePath: string
  ) {
    // Create import request
    const importRequest = await this.prisma.importRequest.create({
      data: {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        type,
        format,
        status: "pending",
        filePath,
      },
    });

    this.logger.log(
      `Import request created: ${importRequest.id} (type: ${type}, format: ${format})`
    );

    // Audit log
    await this.audit.record(ctx, {
      action: "import.requested",
      entityType: "ImportRequest",
      entityId: importRequest.id,
      metadata: { type, format },
    });

    return importRequest;
  }

  /**
   * Execute import job (called by job queue)
   */
  async executeImportJob(importId: string) {
    try {
      this.logger.log(`Starting import job: ${importId}`);

      // Get import request
      const importRequest = await this.prisma.importRequest.findUnique({
        where: { id: importId },
      });

      if (!importRequest) {
        throw new Error(`Import request ${importId} not found`);
      }

      if (!importRequest.filePath) {
        throw new Error(`Import request ${importId} has no file path`);
      }

      // Update status to running
      await this.prisma.importRequest.update({
        where: { id: importId },
        data: { status: "running", updatedAt: new Date() },
      });

      // Parse and process file
      const result = await this.processImportFile(
        importRequest.workspaceId,
        importRequest.type as ImportType,
        importRequest.format as ImportFormat,
        importRequest.filePath,
        importRequest.id
      );

      // Determine final status
      const finalStatus =
        result.errorRows === 0
          ? "success"
          : result.successRows > 0
          ? "partial"
          : "error";

      // Update import request with results
      await this.prisma.importRequest.update({
        where: { id: importId },
        data: {
          status: finalStatus,
          totalRows: result.totalRows,
          successRows: result.successRows,
          errorRows: result.errorRows,
          updatedAt: new Date(),
        },
      });

      // Record billing usage (per row processed)
      const ctx: AuthContextData = {
        userId: importRequest.userId || "system",
        workspaceId: importRequest.workspaceId,
        membership: {
          role: "owner",
        },
      };

      await this.billing.recordUsage(
        ctx,
        "import",
        result.totalRows,
        result.totalRows * 0.0001
      );

      // Audit log
      await this.audit.record(ctx, {
        action: "import.completed",
        entityType: "ImportRequest",
        entityId: importRequest.id,
        metadata: {
          type: importRequest.type,
          format: importRequest.format,
          totalRows: result.totalRows,
          successRows: result.successRows,
          errorRows: result.errorRows,
          status: finalStatus,
        },
      });

      // Send notification
      await this.notifications.sendToWorkspace(
        importRequest.workspaceId,
        "import.completed",
        "Import Completed",
        `Your ${importRequest.type} import has completed. ${result.successRows}/${result.totalRows} rows succeeded.`,
        {
          importId: importRequest.id,
          totalRows: result.totalRows,
          successRows: result.successRows,
          errorRows: result.errorRows,
        }
      );

      this.logger.log(`Import job completed: ${importId}`);
    } catch (error: any) {
      this.logger.error(
        `Import job failed: ${importId} - ${error.message}`,
        error.stack
      );
      await this.markError(importId, error);
      throw error;
    }
  }

  /**
   * Process import file
   */
  private async processImportFile(
    workspaceId: string,
    type: ImportType,
    format: ImportFormat,
    filePath: string,
    importId: string
  ): Promise<{
    totalRows: number;
    successRows: number;
    errorRows: number;
  }> {
    let totalRows = 0;
    let successRows = 0;
    const errors: ImportError[] = [];

    // Parse file based on format
    const rows =
      format === "csv"
        ? await this.parseCSV(filePath)
        : await this.parseJSON(filePath);

    // Process each row
    for (const row of rows) {
      totalRows++;

      try {
        // Validate and import row
        await this.importRow(workspaceId, type, row.data);
        successRows++;
      } catch (error: any) {
        errors.push({
          rowNumber: row.rowNumber,
          data: row.data,
          error: error.message,
        });
      }
    }

    const errorRows = errors.length;

    // Write errors file if needed
    if (errors.length > 0) {
      const errorsPath = this.getErrorsPath(workspaceId, importId);
      fs.writeFileSync(errorsPath, JSON.stringify(errors, null, 2));
    }

    return { totalRows, successRows, errorRows };
  }

  /**
   * Parse CSV file (streaming)
   */
  private async parseCSV(filePath: string): Promise<ImportRow[]> {
    const rows: ImportRow[] = [];
    let rowNumber = 0;
    let headers: string[] = [];

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      rowNumber++;

      if (rowNumber === 1) {
        // Parse headers
        headers = this.parseCSVLine(line);
        continue;
      }

      // Parse data row
      const values = this.parseCSVLine(line);
      const data: any = {};

      headers.forEach((header, index) => {
        data[header] = values[index] || "";
      });

      rows.push({ rowNumber, data });
    }

    return rows;
  }

  /**
   * Parse CSV line (simple implementation)
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * Parse JSON file (streaming for NDJSON or full array)
   */
  private async parseJSON(filePath: string): Promise<ImportRow[]> {
    const content = fs.readFileSync(filePath, "utf-8");
    let data: any[];

    try {
      // Try parsing as JSON array
      data = JSON.parse(content);
      if (!Array.isArray(data)) {
        data = [data];
      }
    } catch {
      // Try parsing as NDJSON
      data = content
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));
    }

    return data.map((item, index) => ({
      rowNumber: index + 1,
      data: item,
    }));
  }

  /**
   * Import a single row based on type
   */
  private async importRow(
    workspaceId: string,
    type: ImportType,
    data: any
  ): Promise<void> {
    switch (type) {
      case "agents":
        await this.importAgent(workspaceId, data);
        break;
      case "workflows":
        await this.importWorkflow(workspaceId, data);
        break;
      case "memory":
        await this.importMemory(workspaceId, data);
        break;
      case "triggers":
        await this.importTrigger(workspaceId, data);
        break;
      case "evals":
        await this.importEval(workspaceId, data);
        break;
      default:
        throw new Error(`Unsupported import type: ${type}`);
    }
  }

  /**
   * Import agent
   */
  private async importAgent(workspaceId: string, data: any) {
    const { name, description, systemPrompt, model, maxSteps, temperature } =
      data;

    if (!name) {
      throw new Error("Agent name is required");
    }

    // Check if agent exists
    const existing = await this.prisma.agentConfig.findFirst({
      where: { workspaceId, name },
    });

    if (existing) {
      // Update existing
      await this.prisma.agentConfig.update({
        where: { id: existing.id },
        data: {
          description: description || existing.description,
          systemPrompt: systemPrompt || existing.systemPrompt,
          model: model || existing.model,
          maxSteps: maxSteps ? parseInt(maxSteps) : existing.maxSteps,
          temperature: temperature ? parseFloat(temperature) : existing.temperature,
        },
      });
    } else {
      // Create new
      await this.prisma.agentConfig.create({
        data: {
          workspaceId,
          name,
          description: description || "",
          systemPrompt: systemPrompt || "You are a helpful AI assistant.",
          model: model || "gpt-4o-mini",
          maxSteps: maxSteps ? parseInt(maxSteps) : 8,
          temperature: temperature ? parseFloat(temperature) : 0.7,
          tools: [],
        },
      });
    }
  }

  /**
   * Import workflow
   */
  private async importWorkflow(workspaceId: string, data: any) {
    const { name, description, triggerType, enabled } = data;

    if (!name || !triggerType) {
      throw new Error("Workflow name and triggerType are required");
    }

    // Check if workflow exists
    const existing = await this.prisma.workflow.findFirst({
      where: { workspaceId, name },
    });

    if (existing) {
      // Update existing
      await this.prisma.workflow.update({
        where: { id: existing.id },
        data: {
          description: description || existing.description,
          triggerType: triggerType || existing.triggerType,
          enabled:
            enabled !== undefined
              ? enabled === "true" || enabled === true
              : existing.enabled,
        },
      });
    } else {
      // Create new - need userId, use first workspace admin
      const admin = await this.prisma.workspaceUser.findFirst({
        where: { workspaceId, role: "owner" },
      });

      if (!admin) {
        throw new Error("No workspace admin found for workflow creation");
      }

      await this.prisma.workflow.create({
        data: {
          workspaceId,
          userId: admin.userId,
          name,
          description: description || "",
          triggerType,
          enabled:
            enabled !== undefined
              ? enabled === "true" || enabled === true
              : true,
        },
      });
    }
  }

  /**
   * Import memory
   */
  private async importMemory(workspaceId: string, data: any) {
    const { content, text } = data;
    const memoryText = content || text;

    if (!memoryText) {
      throw new Error("Memory content/text is required");
    }

    // Get first workspace user for userId
    const user = await this.prisma.workspaceUser.findFirst({
      where: { workspaceId },
    });

    if (!user) {
      throw new Error("No workspace users found");
    }

    // Create memory with placeholder embedding
    await this.prisma.agentMemory.create({
      data: {
        workspaceId,
        userId: user.userId,
        content: memoryText,
        embedding: new Array(1536).fill(0), // Placeholder embedding
      },
    });
  }

  /**
   * Import trigger
   */
  private async importTrigger(workspaceId: string, data: any) {
    const { name, description, eventType, filter, agentId, inputTemplate } =
      data;

    if (!name || !eventType) {
      throw new Error("Trigger name and eventType are required");
    }

    // If agentId provided, validate it exists
    if (agentId) {
      const agent = await this.prisma.agentConfig.findFirst({
        where: { workspaceId, id: agentId },
      });

      if (!agent) {
        throw new Error(`Agent ${agentId} not found in workspace`);
      }
    }

    // Get first workspace user
    const user = await this.prisma.workspaceUser.findFirst({
      where: { workspaceId },
    });

    if (!user) {
      throw new Error("No workspace users found");
    }

    // Check if trigger exists
    const existing = await this.prisma.eventTrigger.findFirst({
      where: { workspaceId, name },
    });

    if (existing) {
      // Update existing
      await this.prisma.eventTrigger.update({
        where: { id: existing.id },
        data: {
          description: description || existing.description,
          eventType: eventType || existing.eventType,
          filter: filter ? JSON.parse(filter) : existing.filter,
        },
      });
    } else {
      // Create new - requires agentId
      if (!agentId) {
        throw new Error("agentId is required for new triggers");
      }

      await this.prisma.eventTrigger.create({
        data: {
          workspaceId,
          userId: user.userId,
          name,
          description: description || "",
          eventType,
          filter: filter ? JSON.parse(filter) : null,
          agentId,
          inputTemplate: inputTemplate ? JSON.parse(inputTemplate) : {},
          enabled: true,
        },
      });
    }
  }

  /**
   * Import eval
   */
  private async importEval(workspaceId: string, data: any) {
    const { suiteName, testName, input, expected } = data;

    if (!suiteName || !testName) {
      throw new Error("Eval suiteName and testName are required");
    }

    // Get or create suite
    let suite = await this.prisma.evalSuite.findFirst({
      where: { workspaceId, name: suiteName },
    });

    if (!suite) {
      suite = await this.prisma.evalSuite.create({
        data: {
          workspaceId,
          name: suiteName,
          description: "",
        },
      });
    }

    // Check if test exists
    const existing = await this.prisma.evalTest.findFirst({
      where: { workspaceId, suiteId: suite.id, name: testName },
    });

    if (existing) {
      // Update existing
      await this.prisma.evalTest.update({
        where: { id: existing.id },
        data: {
          input: input ? JSON.parse(input) : existing.input,
          expected: expected ? JSON.parse(expected) : existing.expected,
        },
      });
    } else {
      // Create new
      await this.prisma.evalTest.create({
        data: {
          workspaceId,
          suiteId: suite.id,
          name: testName,
          input: input ? JSON.parse(input) : {},
          expected: expected ? JSON.parse(expected) : null,
        },
      });
    }
  }

  /**
   * Mark import as error
   */
  private async markError(importId: string, error: Error) {
    try {
      const importRequest = await this.prisma.importRequest.findUnique({
        where: { id: importId },
      });

      if (!importRequest) return;

      await this.prisma.importRequest.update({
        where: { id: importId },
        data: {
          status: "error",
          error: error.message,
          updatedAt: new Date(),
        },
      });

      // Audit log
      const ctx: AuthContextData = {
        userId: importRequest.userId || "system",
        workspaceId: importRequest.workspaceId,
        membership: {
          role: "owner",
        },
      };

      await this.audit.record(ctx, {
        action: "import.failed",
        entityType: "ImportRequest",
        entityId: importRequest.id,
        metadata: {
          type: importRequest.type,
          format: importRequest.format,
          error: error.message,
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to mark import error: ${err.message}`);
    }
  }

  /**
   * List import requests for a workspace
   */
  async listImports(workspaceId: string) {
    return this.prisma.importRequest.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  /**
   * Get import request by ID
   */
  async getImport(importId: string, workspaceId: string) {
    return this.prisma.importRequest.findFirst({
      where: {
        id: importId,
        workspaceId,
      },
    });
  }

  /**
   * Get errors file path
   */
  getErrorsPath(workspaceId: string, importId: string): string {
    const workspaceDir = path.join(this.uploadsDir, workspaceId);
    return path.join(workspaceDir, `${importId}.errors.json`);
  }

  /**
   * Get upload file path
   */
  getUploadPath(
    workspaceId: string,
    importId: string,
    format: ImportFormat
  ): string {
    const workspaceDir = path.join(this.uploadsDir, workspaceId);
    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, { recursive: true });
    }
    return path.join(workspaceDir, `${importId}.${format}`);
  }
}

