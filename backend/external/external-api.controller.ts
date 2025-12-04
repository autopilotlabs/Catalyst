import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { ApiKeyGuard } from "../guards/api-key.guard";
import { RateLimitGuard } from "../guards/rate-limit.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { AuthContext } from "../context/auth-context.decorator";
import { RateLimit } from "../rate-limit/rate-limit.decorator";
import { RequirePermission } from "../auth/permissions.decorator";
import { AuthContextData } from "../context/auth-context.interface";
import { AgentService } from "../agent/agent.service";
import { AgentExecutionService } from "../agent/agent-execution.service";
import { MemoryService } from "../agent/memory/memory.service";
import { EventBusService } from "../events/event-bus.service";
import { AuditService } from "../audit/audit.service";
import { ModelGatewayService, InvokeChatParams } from "../models/model-gateway.service";
import { FileStorageService } from "../storage/file-storage.service";

/**
 * External API Controller
 * Provides simplified API endpoints for external systems (Zapier, Make, n8n, etc.)
 * Authentication: API Key only (x-api-key header)
 * Rate Limited: 60 requests/min per endpoint
 */
@Controller("ext")
@UseGuards(ApiKeyGuard, PermissionsGuard, RateLimitGuard)
export class ExternalApiController {
  constructor(
    private readonly agentService: AgentService,
    private readonly agentExecutor: AgentExecutionService,
    private readonly memoryService: MemoryService,
    private readonly eventBus: EventBusService,
    private readonly audit: AuditService,
    private readonly modelGateway: ModelGatewayService,
    private readonly fileStorage: FileStorageService
  ) {}

  /**
   * POST /ext/agent/run
   * Run an agent with the given input
   * Supports deployments via deploymentId or environment parameters
   */
  @Post("agent/run")
  @RequirePermission("workspace.agents")
  @RateLimit("api.external", 60)
  async runAgent(
    @AuthContext() ctx: AuthContextData,
    @Body() body: {
      input: any;
      agentId?: string;
      deploymentId?: string;
      environment?: 'dev' | 'staging' | 'prod';
    }
  ) {
    // Audit log
    await this.audit.record(ctx, {
      action: "external_api.agent.run",
      entityType: "agent",
      entityId: body.agentId || body.deploymentId || "default",
      metadata: {
        input: body.input,
        deploymentId: body.deploymentId,
        environment: body.environment,
      },
    });

    // Create run
    const run = await this.agentService.createRun(ctx, body.input, body.agentId);

    // Execute with deployment options
    const result = await this.agentExecutor.multiStepRun(ctx, run.id, undefined, {
      deploymentId: body.deploymentId,
      environment: body.environment,
    });

    return {
      success: true,
      runId: run.id,
      output: result,
    };
  }

  /**
   * POST /ext/workflow/trigger
   * Trigger a workflow via event
   */
  @Post("workflow/trigger")
  @RequirePermission("workspace.workflows")
  @RateLimit("api.external", 60)
  async triggerWorkflow(
    @AuthContext() ctx: AuthContextData,
    @Body() body: { eventType: string; data: any }
  ) {
    // Audit log
    await this.audit.record(ctx, {
      action: "external_api.workflow.trigger",
      entityType: "workflow",
      metadata: {
        eventType: body.eventType,
        data: body.data,
      },
    });

    // Emit event to trigger workflow
    await this.eventBus.emit({
      type: body.eventType,
      workspaceId: ctx.workspaceId,
      data: body.data,
    });

    return {
      success: true,
      message: "Event emitted",
      eventType: body.eventType,
    };
  }

  /**
   * POST /ext/memory/store
   * Store a memory
   */
  @Post("memory/store")
  @RequirePermission("workspace.memory")
  @RateLimit("api.external", 60)
  async storeMemory(
    @AuthContext() ctx: AuthContextData,
    @Body() body: { content: string }
  ) {
    // Audit log
    await this.audit.record(ctx, {
      action: "external_api.memory.store",
      entityType: "memory",
      metadata: {
        contentLength: body.content.length,
      },
    });

    const memory = await this.memoryService.storeMemory(ctx, body.content);

    return {
      success: true,
      memoryId: memory.id,
    };
  }

  /**
   * POST /ext/memory/search
   * Search memories
   */
  @Post("memory/search")
  @RequirePermission("workspace.memory")
  @RateLimit("api.external", 60)
  async searchMemory(
    @AuthContext() ctx: AuthContextData,
    @Body() body: { query: string; limit?: number }
  ) {
    // Audit log
    await this.audit.record(ctx, {
      action: "external_api.memory.search",
      entityType: "memory",
      metadata: {
        query: body.query,
        limit: body.limit || 5,
      },
    });

    const results = await this.memoryService.searchMemory(
      ctx,
      body.query,
      body.limit || 5
    );

    return {
      success: true,
      results,
    };
  }

  /**
   * POST /ext/event/emit
   * Emit a custom event
   */
  @Post("event/emit")
  @RequirePermission("workspace.triggers")
  @RateLimit("api.external", 60)
  async emitEvent(
    @AuthContext() ctx: AuthContextData,
    @Body() body: { type: string; data: any }
  ) {
    // Audit log
    await this.audit.record(ctx, {
      action: "external_api.event.emit",
      entityType: "event",
      metadata: {
        eventType: body.type,
        data: body.data,
      },
    });

    // Emit event
    await this.eventBus.emit({
      type: body.type,
      workspaceId: ctx.workspaceId,
      data: body.data,
    });

    return {
      success: true,
      message: "Event emitted",
      type: body.type,
    };
  }

  /**
   * POST /ext/models/generate
   * Generate text using a model (Models-as-a-Service)
   * Supports deployments via deploymentId or modelId + environment
   */
  @Post("models/generate")
  @RequirePermission("workspace.agents")
  @RateLimit("external.model.generate", 60)
  async generateModel(
    @AuthContext() ctx: AuthContextData,
    @Body() body: InvokeChatParams
  ) {
    // Audit log with deployment info
    await this.audit.record(ctx, {
      action: "external.model.generate",
      entityType: "model",
      metadata: {
        modelId: body.modelId,
        deploymentId: body.deploymentId,
        environment: body.environment,
        messageCount: body.messages?.length || 0,
      },
    });

    // Invoke model with deployment support
    const result = await this.modelGateway.invokeChatExternal(ctx, body);

    return result;
  }

  /**
   * POST /ext/files/upload
   * Upload a file via external API
   * Returns fileId for use in other API calls
   */
  @Post("files/upload")
  @UseInterceptors(FileInterceptor("file"))
  @RequirePermission("workspace.manage")
  @RateLimit("external.file.upload", 30)
  async uploadFile(
    @AuthContext() ctx: AuthContextData,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException("No file provided");
    }

    // Audit log
    await this.audit.record(ctx, {
      action: "external.file.upload",
      entityType: "file",
      metadata: {
        name: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
      },
    });

    const uploadedFile = await this.fileStorage.uploadFile(ctx, file);

    return {
      success: true,
      fileId: uploadedFile.id,
      name: uploadedFile.name,
      size: uploadedFile.size,
      mimeType: uploadedFile.mimeType,
    };
  }

  /**
   * GET /ext/files/:fileId
   * Download a file via external API
   * Streams file directly to response
   */
  @Get("files/:fileId")
  @RequirePermission("workspace.view")
  @RateLimit("external.file.download", 60)
  async downloadFile(
    @AuthContext() ctx: AuthContextData,
    @Param("fileId") fileId: string,
    @Res() res: Response
  ) {
    // Audit log
    await this.audit.record(ctx, {
      action: "external.file.download",
      entityType: "file",
      entityId: fileId,
    });

    await this.fileStorage.streamFile(ctx, fileId, res);
  }
}
