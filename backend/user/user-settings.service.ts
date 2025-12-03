import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthContextData } from "../context/auth-context.interface";
import {
  generateApiKey,
  hashApiKey,
  getApiKeyLast4,
} from "./api-key-utils";

export interface UpdateUserSettingsDto {
  theme?: string;
  language?: string;
  timezone?: string;
  notifications?: {
    email?: boolean;
    sms?: boolean;
    agentAlerts?: boolean;
    workflowAlerts?: boolean;
  };
}

export interface CreateApiKeyDto {
  name: string;
  expiresAt?: Date;
}

@Injectable()
export class UserSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  /**
   * Get user settings, creating default settings if they don't exist
   */
  async getSettings(userId: string) {
    let settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    // Create default settings if they don't exist
    if (!settings) {
      settings = await this.prisma.userSettings.create({
        data: {
          userId,
          theme: "light",
          language: "en",
          timezone: "UTC",
          notifications: {
            email: true,
            sms: false,
            agentAlerts: true,
            workflowAlerts: true,
          },
        },
      });
    }

    return settings;
  }

  /**
   * Update user settings
   */
  async updateSettings(
    userId: string,
    data: UpdateUserSettingsDto,
    ctx: AuthContextData
  ) {
    // Validate theme
    if (data.theme && !["light", "dark", "system"].includes(data.theme)) {
      throw new BadRequestException(
        "Invalid theme. Must be one of: light, dark, system"
      );
    }

    // Validate language (basic check - extend as needed)
    if (data.language && data.language.length > 10) {
      throw new BadRequestException("Invalid language code");
    }

    // Validate timezone (basic check - extend as needed)
    if (data.timezone && data.timezone.length > 50) {
      throw new BadRequestException("Invalid timezone");
    }

    // Validate notifications structure
    if (data.notifications) {
      const validKeys = ["email", "sms", "agentAlerts", "workflowAlerts"];
      const providedKeys = Object.keys(data.notifications);
      const invalidKeys = providedKeys.filter((k) => !validKeys.includes(k));
      if (invalidKeys.length > 0) {
        throw new BadRequestException(
          `Invalid notification keys: ${invalidKeys.join(", ")}`
        );
      }
    }

    // Get existing settings or create defaults
    let settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await this.prisma.userSettings.create({
        data: {
          userId,
          theme: "light",
          language: "en",
          timezone: "UTC",
          notifications: {
            email: true,
            sms: false,
            agentAlerts: true,
            workflowAlerts: true,
          },
        },
      });
    }

    // Merge notifications with existing
    const updatedNotifications = data.notifications
      ? {
          ...(typeof settings.notifications === "object" &&
          settings.notifications !== null
            ? settings.notifications
            : {}),
          ...data.notifications,
        }
      : settings.notifications;

    // Update settings
    const updated = await this.prisma.userSettings.update({
      where: { userId },
      data: {
        theme: data.theme ?? settings.theme,
        language: data.language ?? settings.language,
        timezone: data.timezone ?? settings.timezone,
        notifications: updatedNotifications,
      },
    });

    // Audit log - note: this is user-level, so we'll create a special audit entry
    // We'll use the first workspace the user belongs to, or null if none
    const userWorkspace = await this.prisma.workspaceUser.findFirst({
      where: { userId },
      select: { workspaceId: true },
    });

    if (userWorkspace) {
      await this.auditService.record(
        { ...ctx, workspaceId: userWorkspace.workspaceId },
        {
          action: "user.settings.updated",
          entityType: "user_settings",
          entityId: userId,
          metadata: {
            fields: Object.keys(data),
          },
        }
      );
    }

    return updated;
  }

  /**
   * Get all API keys for a user (metadata only, no actual keys)
   */
  async getApiKeys(userId: string) {
    const apiKeys = await this.prisma.userApiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        last4: true,
        expiresAt: true,
        createdAt: true,
        revoked: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return apiKeys;
  }

  /**
   * Create a new API key
   * Returns the full key ONCE - it will never be shown again
   */
  async createApiKey(
    userId: string,
    data: CreateApiKeyDto,
    ctx: AuthContextData
  ) {
    // Validate name
    if (!data.name || data.name.trim().length === 0) {
      throw new BadRequestException("API key name is required");
    }

    if (data.name.length > 100) {
      throw new BadRequestException("API key name is too long (max 100 chars)");
    }

    // Generate API key
    const apiKey = generateApiKey();
    const hashedKey = hashApiKey(apiKey);
    const last4 = getApiKeyLast4(apiKey);

    // Create API key record
    const apiKeyRecord = await this.prisma.userApiKey.create({
      data: {
        userId,
        name: data.name.trim(),
        hashedKey,
        last4,
        expiresAt: data.expiresAt || null,
        revoked: false,
      },
    });

    // Audit log
    const userWorkspace = await this.prisma.workspaceUser.findFirst({
      where: { userId },
      select: { workspaceId: true },
    });

    if (userWorkspace) {
      await this.auditService.record(
        { ...ctx, workspaceId: userWorkspace.workspaceId },
        {
          action: "user.api_key.created",
          entityType: "user_api_key",
          entityId: apiKeyRecord.id,
          metadata: {
            name: data.name,
            last4,
            expiresAt: data.expiresAt,
          },
        }
      );
    }

    // Return full key ONCE
    return {
      id: apiKeyRecord.id,
      name: apiKeyRecord.name,
      apiKey, // Full key - shown only once
      last4,
      expiresAt: apiKeyRecord.expiresAt,
      createdAt: apiKeyRecord.createdAt,
    };
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(userId: string, keyId: string, ctx: AuthContextData) {
    // Find the API key
    const apiKey = await this.prisma.userApiKey.findFirst({
      where: {
        id: keyId,
        userId,
      },
    });

    if (!apiKey) {
      throw new NotFoundException("API key not found");
    }

    // Check if already revoked
    if (apiKey.revoked) {
      throw new BadRequestException("API key is already revoked");
    }

    // Revoke the key
    const updated = await this.prisma.userApiKey.update({
      where: { id: keyId },
      data: { revoked: true },
    });

    // Audit log
    const userWorkspace = await this.prisma.workspaceUser.findFirst({
      where: { userId },
      select: { workspaceId: true },
    });

    if (userWorkspace) {
      await this.auditService.record(
        { ...ctx, workspaceId: userWorkspace.workspaceId },
        {
          action: "user.api_key.revoked",
          entityType: "user_api_key",
          entityId: keyId,
          metadata: {
            name: apiKey.name,
            last4: apiKey.last4,
          },
        }
      );
    }

    return {
      id: updated.id,
      name: updated.name,
      last4: updated.last4,
      revoked: updated.revoked,
    };
  }

  /**
   * Validate an API key (for external API access)
   * Returns userId if valid, null if invalid
   */
  async validateApiKey(apiKey: string): Promise<string | null> {
    const hashedKey = hashApiKey(apiKey);

    const keyRecord = await this.prisma.userApiKey.findFirst({
      where: {
        hashedKey,
        revoked: false,
      },
    });

    // Check if key exists and is not revoked
    if (!keyRecord) {
      return null;
    }

    // Check if key is expired
    if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
      return null;
    }

    return keyRecord.userId;
  }
}
