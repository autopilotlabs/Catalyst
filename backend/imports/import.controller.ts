import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Response,
  StreamableFile,
  HttpException,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Body,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response as ExpressResponse } from "express";
import { ImportService, ImportType, ImportFormat } from "./import.service";
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
import { diskStorage } from "multer";

@Controller("imports")
@UseGuards(
  AuthContextGuard,
  SubscriptionGuard,
  PermissionsGuard,
  RateLimitGuard
)
export class ImportController {
  constructor(
    private readonly importService: ImportService,
    private readonly jobQueue: JobQueueService
  ) {}

  /**
   * Upload and create import request
   */
  @Post("upload")
  @RequirePermission("workspace.manage")
  @RateLimit("import.upload", 20)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (req, file, cb) => {
          // Create temp directory
          const tempDir = "backend/uploads/temp";
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          cb(null, tempDir);
        },
        filename: (req, file, cb) => {
          // Generate unique filename
          const uniqueName = `${Date.now()}-${Math.random()
            .toString(36)
            .substring(7)}-${file.originalname}`;
          cb(null, uniqueName);
        },
      }),
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB max
      },
      fileFilter: (req, file, cb) => {
        // Validate file type
        const allowedTypes = [
          "text/csv",
          "application/json",
          "application/octet-stream",
        ];
        const allowedExtensions = [".csv", ".json"];

        const hasValidType = allowedTypes.includes(file.mimetype);
        const hasValidExtension = allowedExtensions.some((ext) =>
          file.originalname.toLowerCase().endsWith(ext)
        );

        if (hasValidType || hasValidExtension) {
          cb(null, true);
        } else {
          cb(
            new Error(
              "Invalid file type. Only CSV and JSON files are allowed."
            ) as any,
            false
          );
        }
      },
    })
  )
  async uploadImport(
    @AuthContext() ctx: AuthContextData,
    @UploadedFile() file: any,
    @Body("type") type: string,
    @Body("format") format: string
  ) {
    if (!file) {
      throw new HttpException("No file uploaded", HttpStatus.BAD_REQUEST);
    }

    // Validate type and format
    const validTypes = ["agents", "workflows", "memory", "triggers", "evals"];
    const validFormats = ["csv", "json"];

    if (!validTypes.includes(type)) {
      // Clean up uploaded file
      fs.unlinkSync(file.path);
      throw new HttpException(
        `Invalid import type. Must be one of: ${validTypes.join(", ")}`,
        HttpStatus.BAD_REQUEST
      );
    }

    if (!validFormats.includes(format)) {
      // Clean up uploaded file
      fs.unlinkSync(file.path);
      throw new HttpException(
        `Invalid import format. Must be one of: ${validFormats.join(", ")}`,
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      // Create import request first to get ID
      const importRequest = await this.importService.createImport(
        ctx,
        type as ImportType,
        format as ImportFormat,
        "" // Will update with actual path
      );

      // Move file to permanent location
      const finalPath = this.importService.getUploadPath(
        ctx.workspaceId,
        importRequest.id,
        format as ImportFormat
      );

      fs.renameSync(file.path, finalPath);

      // Update import request with file path
      await this.importService["prisma"].importRequest.update({
        where: { id: importRequest.id },
        data: { filePath: finalPath },
      });

      // Enqueue background job
      await this.jobQueue.enqueue(
        "import.execute",
        { importId: importRequest.id },
        ctx.workspaceId
      );

      return {
        importId: importRequest.id,
        status: importRequest.status,
        message: "Import job queued. Processing will begin shortly.",
      };
    } catch (error: any) {
      // Clean up file on error
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }
  }

  /**
   * List all import requests for workspace
   */
  @Get()
  @RequirePermission("workspace.manage")
  @RateLimit("import.list", 60)
  async listImports(@AuthContext() ctx: AuthContextData) {
    const imports = await this.importService.listImports(ctx.workspaceId);
    return { data: imports };
  }

  /**
   * Get import request details
   */
  @Get(":importId")
  @RequirePermission("workspace.manage")
  @RateLimit("import.get", 60)
  async getImport(
    @Param("importId") importId: string,
    @AuthContext() ctx: AuthContextData
  ) {
    const importRequest = await this.importService.getImport(
      importId,
      ctx.workspaceId
    );

    if (!importRequest) {
      throw new HttpException("Import not found", HttpStatus.NOT_FOUND);
    }

    return importRequest;
  }

  /**
   * Download import errors file
   */
  @Get(":importId/errors")
  @RequirePermission("workspace.manage")
  @RateLimit("import.errors", 30)
  async downloadErrors(
    @Param("importId") importId: string,
    @AuthContext() ctx: AuthContextData,
    @Response({ passthrough: true }) res: ExpressResponse
  ) {
    const importRequest = await this.importService.getImport(
      importId,
      ctx.workspaceId
    );

    if (!importRequest) {
      throw new HttpException("Import not found", HttpStatus.NOT_FOUND);
    }

    const errorsPath = this.importService.getErrorsPath(
      ctx.workspaceId,
      importId
    );

    if (!fs.existsSync(errorsPath)) {
      throw new HttpException("No errors file found", HttpStatus.NOT_FOUND);
    }

    // Set headers
    res.set({
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="import-${importId}-errors.json"`,
    });

    // Create read stream
    const fileStream = fs.createReadStream(errorsPath);

    return new StreamableFile(fileStream);
  }
}

