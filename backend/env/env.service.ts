import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ObservabilityService } from "../observability/observability.service";
import { BillingService } from "../billing/billing.service";
import { AuthContextData } from "../context/auth-context.interface";
import { EnvCryptoService } from "./env-crypto.service";

@Injectable()
export class EnvService {
  private readonly logger = new Logger(EnvService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly observability: ObservabilityService,
    private readonly billing: BillingService,
    private readonly crypto: EnvCryptoService
  ) {}

  /**
   * List all environment variables for a workspace (metadata only, no values)
   */
  async listVariables(ctx: AuthContextData) {
    // Only owner and admin can list env vars
    if (!["owner", "admin"].includes(ctx.membership.role)) {
      throw new ForbiddenException(
        "Only owners and admins can access environment variables"
      );
    }

    const vars = await this.prisma.workspaceEnvVar.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: {
        id: true,
        name: true,
        version: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: "asc" },
    });

    // Audit log
    await this.audit.record(ctx, {
      action: "env.listed",
      entityType: "env_var",
      entityId: ctx.workspaceId,
      metadata: { count: vars.length },
    });

    // Observability
    await this.observability.logEvent(ctx, {
      category: "env",
      eventType: "env.listed",
      entityType: "env_var",
      success: true,
      metadata: { count: vars.length },
    });

    return vars;
  }

  /**
   * Get a specific environment variable (decrypted value)
   */
  async getVariable(
    ctx: AuthContextData,
    name: string
  ): Promise<{ value: string }> {
    // Only owner and admin can read env vars
    if (!["owner", "admin"].includes(ctx.membership.role)) {
      throw new ForbiddenException(
        "Only owners and admins can access environment variables"
      );
    }

    const envVar = await this.prisma.workspaceEnvVar.findUnique({
      where: {
        workspaceId_name: {
          workspaceId: ctx.workspaceId,
          name,
        },
      },
    });

    if (!envVar) {
      throw new NotFoundException(`Environment variable '${name}' not found`);
    }

    let value: string;
    try {
      value = this.crypto.decrypt(Buffer.from(envVar.valueEnc));
    } catch (err) {
      this.logger.error(
        `Failed to decrypt env var '${name}' for workspace ${ctx.workspaceId}: ${err}`
      );
      throw new Error("Failed to decrypt environment variable");
    }

    // Audit log
    await this.audit.record(ctx, {
      action: "env.read",
      entityType: "env_var",
      entityId: envVar.id,
      metadata: { name },
    });

    // Observability
    await this.observability.logEvent(ctx, {
      category: "env",
      eventType: "env.read",
      entityId: envVar.id,
      entityType: "env_var",
      success: true,
      metadata: { name },
    });

    // Billing
    await this.billing.recordUsage(ctx, "env.operation", 1, 0.0001, {
      operation: "read",
      name,
    });

    return { value };
  }

  /**
   * Set (create or update) an environment variable
   */
  async setVariable(
    ctx: AuthContextData,
    name: string,
    value: string
  ) {
    // Only owner and admin can create/update env vars
    if (!["owner", "admin"].includes(ctx.membership.role)) {
      throw new ForbiddenException(
        "Only owners and admins can modify environment variables"
      );
    }

    // Validate name
    if (!name || name.trim().length === 0) {
      throw new BadRequestException("Environment variable name is required");
    }

    if (!/^[A-Z_][A-Z0-9_]*$/.test(name)) {
      throw new BadRequestException(
        "Environment variable name must contain only uppercase letters, numbers, and underscores, and start with a letter or underscore"
      );
    }

    if (name.length > 100) {
      throw new BadRequestException(
        "Environment variable name is too long (max 100 chars)"
      );
    }

    // Encrypt value
    let valueEnc: Buffer;
    try {
      valueEnc = this.crypto.encrypt(value);
    } catch (err) {
      this.logger.error(
        `Failed to encrypt env var '${name}' for workspace ${ctx.workspaceId}: ${err}`
      );
      throw new Error("Failed to encrypt environment variable");
    }

    // Upsert
    const existing = await this.prisma.workspaceEnvVar.findUnique({
      where: {
        workspaceId_name: {
          workspaceId: ctx.workspaceId,
          name,
        },
      },
    });

    const envVar = await this.prisma.workspaceEnvVar.upsert({
      where: {
        workspaceId_name: {
          workspaceId: ctx.workspaceId,
          name,
        },
      },
      update: {
        valueEnc: valueEnc as any,
        version: { increment: 1 },
      },
      create: {
        workspaceId: ctx.workspaceId,
        name,
        valueEnc: valueEnc as any,
        version: 1,
      },
    });

    // Audit log
    await this.audit.record(ctx, {
      action: existing ? "env.updated" : "env.created",
      entityType: "env_var",
      entityId: envVar.id,
      metadata: { name, version: envVar.version },
    });

    // Observability
    await this.observability.logEvent(ctx, {
      category: "env",
      eventType: existing ? "env.updated" : "env.created",
      entityId: envVar.id,
      entityType: "env_var",
      success: true,
      metadata: { name, version: envVar.version },
    });

    // Billing
    await this.billing.recordUsage(
      ctx,
      "env.operation",
      1,
      existing ? 0.0001 : 0.0002,
      {
        operation: existing ? "update" : "create",
        name,
      }
    );

    return {
      id: envVar.id,
      name: envVar.name,
      version: envVar.version,
      createdAt: envVar.createdAt,
      updatedAt: envVar.updatedAt,
    };
  }

  /**
   * Delete an environment variable
   */
  async deleteVariable(ctx: AuthContextData, name: string): Promise<void> {
    // Only owner and admin can delete env vars
    if (!["owner", "admin"].includes(ctx.membership.role)) {
      throw new ForbiddenException(
        "Only owners and admins can delete environment variables"
      );
    }

    const envVar = await this.prisma.workspaceEnvVar.findUnique({
      where: {
        workspaceId_name: {
          workspaceId: ctx.workspaceId,
          name,
        },
      },
    });

    if (!envVar) {
      throw new NotFoundException(`Environment variable '${name}' not found`);
    }

    await this.prisma.workspaceEnvVar.delete({
      where: { id: envVar.id },
    });

    // Audit log
    await this.audit.record(ctx, {
      action: "env.deleted",
      entityType: "env_var",
      entityId: envVar.id,
      metadata: { name },
    });

    // Observability
    await this.observability.logEvent(ctx, {
      category: "env",
      eventType: "env.deleted",
      entityId: envVar.id,
      entityType: "env_var",
      success: true,
      metadata: { name },
    });

    // Billing
    await this.billing.recordUsage(ctx, "env.operation", 1, 0.0001, {
      operation: "delete",
      name,
    });
  }

  /**
   * Resolve all environment variables for a workspace
   * Returns a key-value map of all env vars (decrypted)
   * 
   * This is used internally by agents, workflows, etc.
   * Does NOT require owner/admin role - system can call this.
   */
  async resolveAllForWorkspace(
    ctx: AuthContextData
  ): Promise<Record<string, string>> {
    const vars = await this.prisma.workspaceEnvVar.findMany({
      where: { workspaceId: ctx.workspaceId },
    });

    const resolved: Record<string, string> = {};

    for (const envVar of vars) {
      try {
        resolved[envVar.name] = this.crypto.decrypt(Buffer.from(envVar.valueEnc));
      } catch (err) {
        this.logger.error(
          `Failed to decrypt env var '${envVar.name}' for workspace ${ctx.workspaceId}: ${err}`
        );
        // Skip this variable but continue with others
      }
    }

    // Observability (no audit log for internal resolution)
    await this.observability.logEvent(ctx, {
      category: "env",
      eventType: "env.resolved",
      entityType: "env_var",
      success: true,
      metadata: { count: Object.keys(resolved).length },
    });

    return resolved;
  }
}
