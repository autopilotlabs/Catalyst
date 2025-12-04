import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiKeyService } from "./api-key.service";
import { AuthContext } from "../context/auth-context.decorator";
import { AuthContextGuard } from "../context/auth-context.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { WorkspaceLimitGuard, CheckLimit } from "../guards/workspace-limit.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { AuthContextData } from "../context/auth-context.interface";

@Controller("api-keys")
@UseGuards(AuthContextGuard, PermissionsGuard, WorkspaceLimitGuard)
@RequirePermission("workspace.manage")
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  /**
   * List all API keys for the workspace
   */
  @Get()
  async listKeys(@AuthContext() ctx: AuthContextData) {
    return this.apiKeyService.listKeys(ctx);
  }

  /**
   * Create a new API key
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckLimit("apiKeys")
  async createKey(
    @AuthContext() ctx: AuthContextData,
    @Body()
    body: {
      name: string;
      role: string;
      expiresAt?: string;
    }
  ) {
    // Validate role
    const validRoles = ["owner", "admin", "member"];
    if (!validRoles.includes(body.role)) {
      throw new Error(
        `Invalid role. Must be one of: ${validRoles.join(", ")}`
      );
    }

    // Parse expiration
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;

    // Create key
    const result = await this.apiKeyService.createApiKey(
      ctx,
      body.name,
      body.role,
      expiresAt
    );

    return {
      success: true,
      id: result.id,
      key: result.key, // Only returned once!
    };
  }

  /**
   * Revoke an API key
   */
  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async revokeKey(
    @AuthContext() ctx: AuthContextData,
    @Param("id") id: string
  ) {
    await this.apiKeyService.revokeKey(ctx, id);

    return {
      success: true,
      message: "API key revoked",
    };
  }
}
