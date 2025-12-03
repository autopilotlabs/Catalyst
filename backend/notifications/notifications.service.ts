import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthContextData } from "../context/auth-context.interface";

export interface SendNotificationOptions {
  workspaceId: string;
  userId?: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  channel?: "email" | "in_app" | "webhook" | "all";
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  /**
   * Send in-app notification
   */
  async sendInApp(
    workspaceId: string,
    userId: string,
    type: string,
    title: string,
    message: string,
    data: any = {}
  ): Promise<void> {
    try {
      // Check if user has in-app notifications enabled
      const settings = await this.getUserSettings(userId, workspaceId);
      if (!settings?.inAppEnabled) {
        this.logger.debug(
          `In-app notifications disabled for user ${userId}`
        );
        return;
      }

      // Create notification record
      await this.prisma.notification.create({
        data: {
          workspaceId,
          userId,
          type,
          channel: "in_app",
          title,
          message,
          data,
          read: false,
        },
      });

      this.logger.log(
        `In-app notification sent to user ${userId}: ${title}`
      );

      // Audit log
      await this.auditService.record(
        { userId, workspaceId, role: "system" } as AuthContextData,
        {
          action: "notification.sent",
          entityType: "notification",
          entityId: type,
          metadata: {
            channel: "in_app",
            title,
          },
        }
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to send in-app notification: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Send email notification (mocked for now)
   */
  async sendEmail(
    workspaceId: string,
    userId: string,
    type: string,
    title: string,
    message: string,
    data: any = {}
  ): Promise<void> {
    try {
      // Check if user has email notifications enabled
      const settings = await this.getUserSettings(userId, workspaceId);
      if (!settings?.emailEnabled) {
        this.logger.debug(
          `Email notifications disabled for user ${userId}`
        );
        return;
      }

      // Get user email
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (!user?.email) {
        this.logger.warn(`No email found for user ${userId}`);
        return;
      }

      // TODO: Integrate with actual email provider (Nodemailer/Resend/Mailgun)
      // For now, we'll just log and create a notification record
      this.logger.log(
        `[MOCK] Sending email to ${user.email}: ${title}`
      );

      // Create notification record for tracking
      await this.prisma.notification.create({
        data: {
          workspaceId,
          userId,
          type,
          channel: "email",
          title,
          message,
          data: {
            ...data,
            recipient: user.email,
          },
          read: true, // Email notifications are considered "read" immediately
        },
      });

      // Audit log
      await this.auditService.record(
        { userId, workspaceId, role: "system" } as AuthContextData,
        {
          action: "notification.sent",
          entityType: "notification",
          entityId: type,
          metadata: {
            channel: "email",
            title,
            recipient: user.email,
          },
        }
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to send email notification: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Send webhook notification
   */
  async sendWebhook(
    workspaceId: string,
    type: string,
    title: string,
    message: string,
    data: any = {}
  ): Promise<void> {
    try {
      // Get workspace-level webhook settings from any user with webhooks enabled
      const settings = await this.prisma.userNotificationSettings.findFirst({
        where: {
          workspaceId,
          webhookEnabled: true,
          webhookUrl: {
            not: null,
          },
        },
      });

      if (!settings?.webhookUrl) {
        this.logger.debug(
          `No webhook URL configured for workspace ${workspaceId}`
        );
        return;
      }

      // Prepare webhook payload
      const payload = {
        type,
        title,
        message,
        data,
        timestamp: new Date().toISOString(),
        workspaceId,
      };

      // Send webhook
      const response = await fetch(settings.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Catalyst-Notifications/1.0",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          `Webhook failed with status ${response.status}`
        );
      }

      this.logger.log(
        `Webhook sent to ${settings.webhookUrl}: ${title}`
      );

      // Create notification record for tracking
      await this.prisma.notification.create({
        data: {
          workspaceId,
          userId: settings.userId,
          type,
          channel: "webhook",
          title,
          message,
          data: {
            ...data,
            webhookUrl: settings.webhookUrl,
            status: response.status,
          },
          read: true, // Webhook notifications are considered "read" immediately
        },
      });

      // Audit log
      await this.auditService.record(
        { userId: settings.userId, workspaceId, role: "system" } as AuthContextData,
        {
          action: "notification.sent",
          entityType: "notification",
          entityId: type,
          metadata: {
            channel: "webhook",
            title,
            webhookUrl: settings.webhookUrl,
          },
        }
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to send webhook notification: ${error.message}`,
        error.stack
      );

      // Log webhook failure
      await this.auditService.record(
        { userId: "system", workspaceId, role: "system" } as AuthContextData,
        {
          action: "notification.webhook.failed",
          entityType: "notification",
          entityId: type,
          metadata: {
            error: error.message,
            title,
          },
        }
      );
    }
  }

  /**
   * Send notification to all workspace members
   */
  async sendToWorkspace(
    workspaceId: string,
    type: string,
    title: string,
    message: string,
    data: any = {}
  ): Promise<void> {
    try {
      // Get all workspace members
      const workspaceUsers = await this.prisma.workspaceUser.findMany({
        where: { workspaceId },
        select: { userId: true },
      });

      this.logger.log(
        `Sending notification to ${workspaceUsers.length} workspace members`
      );

      // Send to each member
      for (const wu of workspaceUsers) {
        await this.sendInApp(
          workspaceId,
          wu.userId,
          type,
          title,
          message,
          data
        );
      }

      // Also send webhook to workspace
      await this.sendWebhook(workspaceId, type, title, message, data);
    } catch (error: any) {
      this.logger.error(
        `Failed to send workspace notification: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Generic send method that routes to appropriate channels
   */
  async send(opts: SendNotificationOptions): Promise<void> {
    const {
      workspaceId,
      userId,
      type,
      title,
      message,
      data = {},
      channel = "all",
    } = opts;

    try {
      if (channel === "all" || channel === "in_app") {
        if (userId) {
          await this.sendInApp(
            workspaceId,
            userId,
            type,
            title,
            message,
            data
          );
        } else {
          // Send to all workspace members
          await this.sendToWorkspace(
            workspaceId,
            type,
            title,
            message,
            data
          );
        }
      }

      if (channel === "all" || channel === "email") {
        if (userId) {
          await this.sendEmail(
            workspaceId,
            userId,
            type,
            title,
            message,
            data
          );
        }
      }

      if (channel === "all" || channel === "webhook") {
        await this.sendWebhook(workspaceId, type, title, message, data);
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to send notification: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Get user notifications
   */
  async getNotifications(
    userId: string,
    workspaceId: string,
    options: {
      unread?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const { unread, limit = 50, offset = 0 } = options;

    return await this.prisma.notification.findMany({
      where: {
        userId,
        workspaceId,
        ...(unread !== undefined && { read: !unread }),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(
    notificationId: string,
    userId: string,
    workspaceId: string
  ): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
        workspaceId,
      },
      data: {
        read: true,
      },
    });
  }

  /**
   * Get or create user notification settings
   */
  async getUserSettings(
    userId: string,
    workspaceId: string
  ) {
    let settings = await this.prisma.userNotificationSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await this.prisma.userNotificationSettings.create({
        data: {
          userId,
          workspaceId,
          emailEnabled: true,
          inAppEnabled: true,
          webhookEnabled: false,
        },
      });
    }

    return settings;
  }

  /**
   * Update user notification settings
   */
  async updateSettings(
    userId: string,
    workspaceId: string,
    updates: {
      emailEnabled?: boolean;
      inAppEnabled?: boolean;
      webhookUrl?: string;
      webhookEnabled?: boolean;
    }
  ) {
    // Get or create settings
    await this.getUserSettings(userId, workspaceId);

    // Update settings
    const settings = await this.prisma.userNotificationSettings.update({
      where: { userId },
      data: updates,
    });

    // Audit log
    await this.auditService.record(
      { userId, workspaceId, role: "user" } as AuthContextData,
      {
        action: "notification.settings.updated",
        entityType: "settings",
        entityId: userId,
        metadata: updates,
      }
    );

    return settings;
  }

  /**
   * Get unread count
   */
  async getUnreadCount(
    userId: string,
    workspaceId: string
  ): Promise<number> {
    return await this.prisma.notification.count({
      where: {
        userId,
        workspaceId,
        read: false,
      },
    });
  }
}
