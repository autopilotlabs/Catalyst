import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Response,
  StreamableFile,
  HttpException,
  HttpStatus,
  Request,
} from "@nestjs/common";
import { Response as ExpressResponse } from "express";
import { ExportService, ExportType, ExportFormat } from "./export.service";
import { AuthContext } from "../context/auth-context.decorator";
import { AuthContextGuard } from "../context/auth-context.guard";
import { SubscriptionGuard } from "../guards/subscription.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { RateLimitGuard } from "../guards/rate-limit.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { RateLimit } from "../rate-limit/rate-limit.decorator";
import { AuthContextData } from "../context/auth-context.interface";
import { JobQueueService } from "../jobs/job-queue.service";
import * as fs from "fs";
import * as path from "path";

@Controller("exports")
@UseGuards(
  AuthContextGuard,
  SubscriptionGuard,
  PermissionsGuard,
  RateLimitGuard
)
export class ExportController {
  constructor(
    private readonly exportService: ExportService,
    private readonly jobQueue: JobQueueService
  ) {}

  /**
   * Create a new export request
   */
  @Post()
  @RequirePermission("workspace.analytics")
  @RateLimit("export.create", 30)
  async createExport(
    @AuthContext() ctx: AuthContextData,
    @Body() body: { type: ExportType; format: ExportFormat }
  ) {
    const { type, format } = body;

    // Validate type and format
    const validTypes = [
      "agents",
      "workflows",
      "runs",
      "memory",
      "audit",
      "billing",
      "evals",
    ];
    const validFormats = ["csv", "json", "zip"];

    if (!validTypes.includes(type)) {
      throw new HttpException(
        `Invalid export type. Must be one of: ${validTypes.join(", ")}`,
        HttpStatus.BAD_REQUEST
      );
    }

    if (!validFormats.includes(format)) {
      throw new HttpException(
        `Invalid export format. Must be one of: ${validFormats.join(", ")}`,
        HttpStatus.BAD_REQUEST
      );
    }

    // Create export request
    const exportRequest = await this.exportService.createExport(
      ctx,
      type,
      format
    );

    // Enqueue background job
    await this.jobQueue.enqueue(
      "export.generate",
      { exportId: exportRequest.id },
      ctx.workspaceId
    );

    return {
      exportId: exportRequest.id,
      status: exportRequest.status,
      message: "Export job queued. You will be notified when ready.",
    };
  }

  /**
   * List all export requests for workspace
   */
  @Get()
  @RequirePermission("workspace.analytics")
  @RateLimit("export.list", 60)
  async listExports(@AuthContext() ctx: AuthContextData) {
    const exports = await this.exportService.listExports(ctx.workspaceId);
    return { data: exports };
  }

  /**
   * Get export request details
   */
  @Get(":exportId")
  @RequirePermission("workspace.analytics")
  @RateLimit("export.get", 60)
  async getExport(
    @Param("exportId") exportId: string,
    @AuthContext() ctx: AuthContextData
  ) {
    const exportRequest = await this.exportService.getExport(
      exportId,
      ctx.workspaceId
    );

    if (!exportRequest) {
      throw new HttpException("Export not found", HttpStatus.NOT_FOUND);
    }

    return exportRequest;
  }

  /**
   * Download export file
   */
  @Get(":exportId/download")
  @RequirePermission("workspace.analytics")
  @RateLimit("export.download", 30)
  async downloadExport(
    @Param("exportId") exportId: string,
    @AuthContext() ctx: AuthContextData,
    @Response({ passthrough: true }) res: ExpressResponse
  ) {
    const exportRequest = await this.exportService.getExport(
      exportId,
      ctx.workspaceId
    );

    if (!exportRequest) {
      throw new HttpException("Export not found", HttpStatus.NOT_FOUND);
    }

    if (exportRequest.status !== "success") {
      throw new HttpException(
        `Export is not ready. Current status: ${exportRequest.status}`,
        HttpStatus.BAD_REQUEST
      );
    }

    if (!exportRequest.filePath) {
      throw new HttpException(
        "Export file path not found",
        HttpStatus.NOT_FOUND
      );
    }

    // Check if file exists
    if (!fs.existsSync(exportRequest.filePath)) {
      throw new HttpException("Export file not found", HttpStatus.NOT_FOUND);
    }

    // Set content type based on format
    const contentTypes: Record<string, string> = {
      csv: "text/csv",
      json: "application/json",
      zip: "application/zip",
    };

    const contentType =
      contentTypes[exportRequest.format] || "application/octet-stream";
    const fileName = `${exportRequest.type}-${exportRequest.id}.${exportRequest.format}`;

    // Set headers
    res.set({
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
    });

    // Create read stream
    const fileStream = fs.createReadStream(exportRequest.filePath);

    return new StreamableFile(fileStream);
  }
}
