import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { AuthContextGuard } from "../context/auth-context.guard";
import { AuthContext } from "../context/auth-context.decorator";
import { AuthContextData } from "../context/auth-context.interface";
import { PermissionsGuard } from "../guards/permissions.guard";
import { RequirePermission } from "../auth/permissions.decorator";

@Controller("notifications")
@UseGuards(AuthContextGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService
  ) {}

  /**
   * GET /notifications
   * List in-app notifications for the authenticated user
   */
  @Get()
  async listNotifications(
    @AuthContext() ctx: AuthContextData,
    @Query("unread") unread?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    const notifications = await this.notificationsService.getNotifications(
      ctx.userId,
      ctx.workspaceId,
      {
        unread: unread === "true",
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
      }
    );

    const unreadCount = await this.notificationsService.getUnreadCount(
      ctx.userId,
      ctx.workspaceId
    );

    return {
      notifications,
      unreadCount,
    };
  }

  /**
   * PATCH /notifications/:id/read
   * Mark notification as read
   */
  @Patch(":id/read")
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @AuthContext() ctx: AuthContextData,
    @Param("id") id: string
  ) {
    await this.notificationsService.markAsRead(
      id,
      ctx.userId,
      ctx.workspaceId
    );

    return { success: true };
  }

  /**
   * GET /notifications/settings
   * Fetch user notification settings
   */
  @Get("settings")
  async getSettings(@AuthContext() ctx: AuthContextData) {
    const settings = await this.notificationsService.getUserSettings(
      ctx.userId,
      ctx.workspaceId
    );

    return settings;
  }

  /**
   * PATCH /notifications/settings
   * Update user notification settings
   */
  @Patch("settings")
  @UseGuards(PermissionsGuard)
  @RequirePermission("workspace.members")
  @HttpCode(HttpStatus.OK)
  async updateSettings(
    @AuthContext() ctx: AuthContextData,
    @Body()
    body: {
      emailEnabled?: boolean;
      inAppEnabled?: boolean;
      webhookUrl?: string;
      webhookEnabled?: boolean;
    }
  ) {
    const settings = await this.notificationsService.updateSettings(
      ctx.userId,
      ctx.workspaceId,
      body
    );

    return settings;
  }
}
