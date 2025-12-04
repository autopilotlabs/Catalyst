import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthContextData } from "../context/auth-context.interface";
import * as crypto from "crypto";

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /**
   * Generate a random API key
   */
  private generateKey(): string {
    const randomBytes = crypto.randomBytes(32);
    return `apikey_${randomBytes.toString("hex")}`;
  }

  /**
   * Hash an API key with SHA-256
   */
  hashKey(key: string): string {
    return crypto.createHash("sha256").update(key).digest("hex");
  }

  /**
   * Create a new API key
   * @returns The raw key (only returned once!)
   */
  async createApiKey(
    ctx: AuthContextData,
    name: string,
    role: string,
    expiresAt?: Date
  ): Promise<{ key: string; id: string }> {
    // Generate raw key
    const rawKey = this.generateKey();
    const keyHash = this.hashKey(rawKey);

    // Create API key record
    const apiKey = await this.prisma.apiKey.create({
      data: {
        workspaceId: ctx.workspaceId,
        name,
        keyHash,
        role,
        expiresAt: expiresAt || null,
      },
    });

    // Audit log
    await this.audit.record(ctx, {
      action: "api_key.created",
      entityType: "api_key",
      entityId: apiKey.id,
      metadata: {
        name,
        role,
        expiresAt: expiresAt?.toISOString(),
      },
    });

    this.logger.log(`API key created: ${apiKey.id} for workspace ${ctx.workspaceId}`);

    // Return raw key (only time it's ever shown!)
    return {
      key: rawKey,
      id: apiKey.id,
    };
  }

  /**
   * Validate an API key and return the associated context
   */
  async validateApiKey(rawKey: string): Promise<AuthContextData | null> {
    const keyHash = this.hashKey(rawKey);

    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        keyHash,
        revokedAt: null,
      },
      include: {
        workspace: true,
      },
    });

    if (!apiKey) {
      return null;
    }

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      this.logger.warn(`API key expired: ${apiKey.id}`);
      return null;
    }

    // Return auth context
    return {
      userId: null as any, // API keys don't have a user ID
      workspaceId: apiKey.workspaceId,
      membership: {
        role: apiKey.role as 'owner' | 'admin' | 'member' | 'viewer',
      },
      isApiKey: true,
    };
  }

  /**
   * Revoke an API key
   */
  async revokeKey(ctx: AuthContextData, id: string): Promise<void> {
    // Verify ownership
    const existing = await this.prisma.apiKey.findFirst({
      where: {
        id,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!existing) {
      throw new Error("API key not found");
    }

    // Revoke
    await this.prisma.apiKey.update({
      where: { id },
      data: {
        revokedAt: new Date(),
      },
    });

    // Audit log
    await this.audit.record(ctx, {
      action: "api_key.revoked",
      entityType: "api_key",
      entityId: id,
      metadata: {
        name: existing.name,
      },
    });

    this.logger.log(`API key revoked: ${id}`);
  }

  /**
   * List API keys for a workspace
   */
  async listKeys(ctx: AuthContextData): Promise<any[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        revokedAt: null,
      },
      select: {
        id: true,
        name: true,
        role: true,
        expiresAt: true,
        createdAt: true,
        revokedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return keys;
  }
}
