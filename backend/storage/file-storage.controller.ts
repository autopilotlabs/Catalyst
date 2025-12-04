import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { FileStorageService } from "./file-storage.service";
import { AuthContext } from "../context/auth-context.decorator";
import { AuthContextGuard } from "../context/auth-context.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { SubscriptionGuard } from "../guards/subscription.guard";
import { RateLimitGuard } from "../guards/rate-limit.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { RateLimit } from "../rate-limit/rate-limit.decorator";
import { AuthContextData } from "../context/auth-context.interface";

@Controller("files")
@UseGuards(AuthContextGuard, SubscriptionGuard, PermissionsGuard, RateLimitGuard)
export class FileStorageController {
  constructor(private readonly fileStorageService: FileStorageService) {}

  /**
   * Upload a file
   * POST /files/upload
   * Rate limit: 20/min
   * RBAC: workspace.manage
   */
  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  @RequirePermission("workspace.manage")
  @RateLimit("file.upload", 20)
  @HttpCode(HttpStatus.CREATED)
  async uploadFile(
    @AuthContext() ctx: AuthContextData,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException("No file provided");
    }

    const uploadedFile = await this.fileStorageService.uploadFile(ctx, file);

    return {
      success: true,
      file: {
        id: uploadedFile.id,
        name: uploadedFile.name,
        size: uploadedFile.size,
        mimeType: uploadedFile.mimeType,
        createdAt: uploadedFile.createdAt,
      },
    };
  }

  /**
   * List all files in workspace
   * GET /files
   * Rate limit: 60/min
   */
  @Get()
  @RequirePermission("workspace.view")
  @RateLimit("file.list", 60)
  async listFiles(
    @AuthContext() ctx: AuthContextData,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    const files = await this.fileStorageService.listFiles(
      ctx,
      limit ? parseInt(limit) : 100,
      offset ? parseInt(offset) : 0
    );

    return {
      success: true,
      files: files.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        mimeType: f.mimeType,
        createdAt: f.createdAt,
        createdBy: f.createdBy
          ? {
              id: f.createdBy.id,
              email: f.createdBy.email,
              name: `${f.createdBy.firstName || ""} ${f.createdBy.lastName || ""}`.trim(),
            }
          : null,
        refs: f.refs,
      })),
    };
  }

  /**
   * Get file metadata
   * GET /files/:fileId
   * Rate limit: 60/min
   */
  @Get(":fileId")
  @RequirePermission("workspace.view")
  @RateLimit("file.get", 60)
  async getFile(
    @AuthContext() ctx: AuthContextData,
    @Param("fileId") fileId: string
  ) {
    const file = await this.fileStorageService.getFile(ctx, fileId);

    return {
      success: true,
      file: {
        id: file.id,
        name: file.name,
        size: file.size,
        mimeType: file.mimeType,
        createdAt: file.createdAt,
        metadata: file.metadata,
        createdBy: file.createdBy
          ? {
              id: file.createdBy.id,
              email: file.createdBy.email,
              name: `${file.createdBy.firstName || ""} ${file.createdBy.lastName || ""}`.trim(),
            }
          : null,
        refs: file.refs,
      },
    };
  }

  /**
   * Download/stream a file
   * GET /files/:fileId/download
   * Rate limit: 60/min
   */
  @Get(":fileId/download")
  @RequirePermission("workspace.view")
  @RateLimit("file.download", 60)
  async downloadFile(
    @AuthContext() ctx: AuthContextData,
    @Param("fileId") fileId: string,
    @Res() res: Response
  ) {
    await this.fileStorageService.streamFile(ctx, fileId, res);
  }

  /**
   * Delete a file
   * DELETE /files/:fileId
   * Rate limit: 30/min
   * Only owner/admin can delete
   */
  @Delete(":fileId")
  @RequirePermission("workspace.manage")
  @RateLimit("file.delete", 30)
  @HttpCode(HttpStatus.OK)
  async deleteFile(
    @AuthContext() ctx: AuthContextData,
    @Param("fileId") fileId: string
  ) {
    const result = await this.fileStorageService.deleteFile(ctx, fileId);

    return result;
  }

  /**
   * Create a file reference
   * POST /files/:fileId/refs
   * Rate limit: 60/min
   */
  @Post(":fileId/refs")
  @RequirePermission("workspace.manage")
  @RateLimit("file.ref.create", 60)
  @HttpCode(HttpStatus.CREATED)
  async createFileRef(
    @AuthContext() ctx: AuthContextData,
    @Param("fileId") fileId: string,
    @Body() body: { entityType: string; entityId?: string }
  ) {
    if (!body.entityType) {
      throw new BadRequestException("entityType is required");
    }

    const ref = await this.fileStorageService.createRef(
      ctx,
      fileId,
      body.entityType,
      body.entityId
    );

    return {
      success: true,
      ref: {
        id: ref.id,
        fileId: ref.fileId,
        entityType: ref.entityType,
        entityId: ref.entityId,
        createdAt: ref.createdAt,
      },
    };
  }

  /**
   * List file references for entity
   * GET /files/refs/:entityType/:entityId?
   * Rate limit: 60/min
   */
  @Get("refs/:entityType/:entityId?")
  @RequirePermission("workspace.view")
  @RateLimit("file.ref.list", 60)
  async listFileRefs(
    @AuthContext() ctx: AuthContextData,
    @Param("entityType") entityType: string,
    @Param("entityId") entityId?: string
  ) {
    const refs = await this.fileStorageService.listRefs(
      ctx,
      entityType,
      entityId
    );

    return {
      success: true,
      refs: refs.map((r) => ({
        id: r.id,
        fileId: r.fileId,
        entityType: r.entityType,
        entityId: r.entityId,
        createdAt: r.createdAt,
        file: r.file,
      })),
    };
  }
}
