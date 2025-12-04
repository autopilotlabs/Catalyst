import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ObservabilityService } from "../observability/observability.service";
import { BillingService } from "../billing/billing.service";
import { AuthContextData } from "../context/auth-context.interface";
import * as fs from "fs";
import * as path from "path";
import { Response } from "express";
import { createReadStream } from "fs";
import { promisify } from "util";

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);
const exists = promisify(fs.exists);

// Maximum file size: 100MB (configurable via env)
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "104857600"); // 100MB

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly storageBasePath = path.join(
    process.cwd(),
    "backend",
    "storage",
    "files"
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly observability: ObservabilityService,
    private readonly billing: BillingService
  ) {}

  /**
   * Upload a file to workspace storage
   */
  async uploadFile(
    ctx: AuthContextData,
    file: Express.Multer.File,
    metadata?: any
  ) {
    const startTime = Date.now();

    try {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        throw new BadRequestException(
          `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
        );
      }

      // Create file record
      const fileRecord = await this.prisma.fileStorage.create({
        data: {
          workspaceId: ctx.workspaceId,
          name: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          path: "", // Will update after writing to disk
          createdById: ctx.userId,
          metadata: metadata || {},
        },
      });

      // Construct storage path: {workspaceId}/{fileId}
      const workspacePath = path.join(this.storageBasePath, ctx.workspaceId);
      const filePath = path.join(workspacePath, fileRecord.id);

      // Ensure workspace directory exists
      await mkdir(workspacePath, { recursive: true });

      // Write file to disk
      await writeFile(filePath, file.buffer);

      // Update file record with path
      const updatedFile = await this.prisma.fileStorage.update({
        where: { id: fileRecord.id },
        data: {
          path: filePath,
        },
      });

      const durationMs = Date.now() - startTime;

      // Audit logging
      await this.audit.record(ctx, {
        action: "file.upload",
        entityType: "file",
        entityId: fileRecord.id,
        metadata: {
          name: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
        },
      });

      // Observability
      await this.observability.logEvent(ctx, {
        category: "file",
        eventType: "file.upload",
        entityId: fileRecord.id,
        entityType: "file",
        durationMs,
        success: true,
        metadata: {
          name: file.originalname,
          size: file.size,
        },
      });

      // Billing - charge for storage (size in MB)
      const sizeMB = file.size / 1024 / 1024;
      const cost = sizeMB * 0.01; // $0.01 per MB
      await this.billing.recordUsage(ctx, "file.upload", 1, cost, {
        fileId: fileRecord.id,
        size: file.size,
      });

      this.logger.log(
        `File uploaded: ${fileRecord.id} (${file.originalname}, ${file.size} bytes) for workspace ${ctx.workspaceId}`
      );

      return updatedFile;
    } catch (error: any) {
      const durationMs = Date.now() - startTime;

      // Observability for failure
      await this.observability.logEvent(ctx, {
        category: "file",
        eventType: "file.upload",
        durationMs,
        success: false,
        metadata: {
          error: error.message,
        },
      });

      throw error;
    }
  }

  /**
   * Create a file reference linking file to entity
   */
  async createRef(
    ctx: AuthContextData,
    fileId: string,
    entityType: string,
    entityId?: string
  ) {
    try {
      // Verify file exists and belongs to workspace
      const file = await this.prisma.fileStorage.findFirst({
        where: {
          id: fileId,
          workspaceId: ctx.workspaceId,
        },
      });

      if (!file) {
        throw new NotFoundException(`File ${fileId} not found`);
      }

      // Create reference
      const ref = await this.prisma.fileRef.create({
        data: {
          workspaceId: ctx.workspaceId,
          fileId,
          entityType,
          entityId: entityId || null,
        },
      });

      // Audit logging
      await this.audit.record(ctx, {
        action: "file.ref.create",
        entityType: "file-ref",
        entityId: ref.id,
        metadata: {
          fileId,
          entityType,
          entityId,
        },
      });

      // Observability
      await this.observability.logEvent(ctx, {
        category: "file",
        eventType: "file.ref.create",
        entityId: ref.id,
        entityType: "file-ref",
        success: true,
        metadata: {
          fileId,
          entityType,
          entityId,
        },
      });

      // Billing
      await this.billing.recordUsage(ctx, "file.ref.create", 1, 0.001, {
        fileId,
        entityType,
        entityId,
      });

      this.logger.log(
        `File reference created: ${ref.id} (file: ${fileId}, entity: ${entityType}:${entityId}) for workspace ${ctx.workspaceId}`
      );

      return ref;
    } catch (error: any) {
      this.logger.error(
        `Failed to create file reference: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * List all files in workspace
   */
  async listFiles(ctx: AuthContextData, limit = 100, offset = 0) {
    const files = await this.prisma.fileStorage.findMany({
      where: {
        workspaceId: ctx.workspaceId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip: offset,
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        refs: {
          select: {
            id: true,
            entityType: true,
            entityId: true,
            createdAt: true,
          },
        },
      },
    });

    return files;
  }

  /**
   * Get file metadata by ID
   */
  async getFile(ctx: AuthContextData, fileId: string) {
    const file = await this.prisma.fileStorage.findFirst({
      where: {
        id: fileId,
        workspaceId: ctx.workspaceId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        refs: {
          select: {
            id: true,
            entityType: true,
            entityId: true,
            createdAt: true,
          },
        },
      },
    });

    if (!file) {
      throw new NotFoundException(`File ${fileId} not found`);
    }

    return file;
  }

  /**
   * Delete a file (admin/owner only)
   */
  async deleteFile(ctx: AuthContextData, fileId: string) {
    const startTime = Date.now();

    try {
      // Get file
      const file = await this.prisma.fileStorage.findFirst({
        where: {
          id: fileId,
          workspaceId: ctx.workspaceId,
        },
      });

      if (!file) {
        throw new NotFoundException(`File ${fileId} not found`);
      }

      // Check ownership (only creator or admin can delete)
      if (file.createdById !== ctx.userId && ctx.role !== "admin") {
        throw new ForbiddenException("You do not have permission to delete this file");
      }

      // Delete file from disk
      if (await exists(file.path)) {
        await unlink(file.path);
      }

      // Delete all references first
      await this.prisma.fileRef.deleteMany({
        where: {
          fileId,
        },
      });

      // Delete file record
      await this.prisma.fileStorage.delete({
        where: {
          id: fileId,
        },
      });

      const durationMs = Date.now() - startTime;

      // Audit logging
      await this.audit.record(ctx, {
        action: "file.delete",
        entityType: "file",
        entityId: fileId,
        metadata: {
          name: file.name,
          size: file.size,
        },
      });

      // Observability
      await this.observability.logEvent(ctx, {
        category: "file",
        eventType: "file.delete",
        entityId: fileId,
        entityType: "file",
        durationMs,
        success: true,
        metadata: {
          name: file.name,
          size: file.size,
        },
      });

      this.logger.log(
        `File deleted: ${fileId} (${file.name}) for workspace ${ctx.workspaceId}`
      );

      return { success: true, message: "File deleted successfully" };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;

      // Observability for failure
      await this.observability.logEvent(ctx, {
        category: "file",
        eventType: "file.delete",
        entityId: fileId,
        entityType: "file",
        durationMs,
        success: false,
        metadata: {
          error: error.message,
        },
      });

      throw error;
    }
  }

  /**
   * List file references by entity
   */
  async listRefs(ctx: AuthContextData, entityType: string, entityId?: string) {
    const where: any = {
      workspaceId: ctx.workspaceId,
      entityType,
    };

    if (entityId) {
      where.entityId = entityId;
    }

    const refs = await this.prisma.fileRef.findMany({
      where,
      include: {
        file: {
          select: {
            id: true,
            name: true,
            size: true,
            mimeType: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return refs;
  }

  /**
   * Stream file to response (for downloads)
   */
  async streamFile(ctx: AuthContextData, fileId: string, res: Response) {
    const startTime = Date.now();

    try {
      // Get file
      const file = await this.prisma.fileStorage.findFirst({
        where: {
          id: fileId,
          workspaceId: ctx.workspaceId,
        },
      });

      if (!file) {
        throw new NotFoundException(`File ${fileId} not found`);
      }

      // Verify file exists on disk
      if (!(await exists(file.path))) {
        throw new NotFoundException(`File ${fileId} not found on disk`);
      }

      // Get file stats
      const stats = await stat(file.path);

      // Set response headers
      res.setHeader("Content-Type", file.mimeType);
      res.setHeader("Content-Length", stats.size);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(file.name)}"`
      );

      // Stream file
      const stream = createReadStream(file.path);
      stream.pipe(res);

      // Wait for stream to finish
      await new Promise((resolve, reject) => {
        stream.on("end", resolve);
        stream.on("error", reject);
        res.on("error", reject);
      });

      const durationMs = Date.now() - startTime;

      // Audit logging
      await this.audit.record(ctx, {
        action: "file.download",
        entityType: "file",
        entityId: fileId,
        metadata: {
          name: file.name,
          size: file.size,
        },
      });

      // Observability
      await this.observability.logEvent(ctx, {
        category: "file",
        eventType: "file.download",
        entityId: fileId,
        entityType: "file",
        durationMs,
        success: true,
        metadata: {
          name: file.name,
          size: file.size,
        },
      });

      // Billing - charge for bandwidth (size in MB)
      const sizeMB = file.size / 1024 / 1024;
      const cost = sizeMB * 0.005; // $0.005 per MB bandwidth
      await this.billing.recordUsage(ctx, "file.download", 1, cost, {
        fileId,
        size: file.size,
      });

      this.logger.log(
        `File downloaded: ${fileId} (${file.name}) for workspace ${ctx.workspaceId}`
      );
    } catch (error: any) {
      const durationMs = Date.now() - startTime;

      // Observability for failure
      await this.observability.logEvent(ctx, {
        category: "file",
        eventType: "file.download",
        entityId: fileId,
        entityType: "file",
        durationMs,
        success: false,
        metadata: {
          error: error.message,
        },
      });

      this.logger.error(
        `Failed to stream file ${fileId}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Helper: Attach file reference to entity (used by other services)
   */
  async attachFileRef(
    ctx: AuthContextData,
    fileId: string,
    entityType: string,
    entityId: string
  ) {
    return this.createRef(ctx, fileId, entityType, entityId);
  }
}
