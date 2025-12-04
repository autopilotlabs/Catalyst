import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthContext } from "../context/auth-context.decorator";
import { AuthContextGuard } from "../context/auth-context.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { AuthContextData } from "../context/auth-context.interface";
import { AuditService } from "../audit/audit.service";

@Controller("workspace/members")
@UseGuards(AuthContextGuard, PermissionsGuard)
export class MembersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  @Get()
  @RequirePermission("workspace.manage")
  async listMembers(@AuthContext() ctx: AuthContextData) {
    const members = await this.prisma.workspaceUser.findMany({
      where: {
        workspaceId: ctx.workspaceId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return members.map((m) => ({
      id: m.id,
      role: m.role,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      user: m.user,
    }));
  }

  @Patch(":id")
  @RequirePermission("workspace.manage")
  async updateMemberRole(
    @Param("id") membershipId: string,
    @Body("role") newRole: string,
    @AuthContext() ctx: AuthContextData
  ) {
    // Validate role
    const validRoles = ["owner", "admin", "member", "viewer"];
    if (!validRoles.includes(newRole)) {
      throw new BadRequestException(
        `Invalid role. Must be one of: ${validRoles.join(", ")}`
      );
    }

    // Get the membership
    const membership = await this.prisma.workspaceUser.findFirst({
      where: {
        id: membershipId,
        workspaceId: ctx.workspaceId,
      },
      include: {
        user: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException("Member not found");
    }

    // Prevent demoting the last owner
    if (membership.role === "owner" && newRole !== "owner") {
      const ownerCount = await this.prisma.workspaceUser.count({
        where: {
          workspaceId: ctx.workspaceId,
          role: "owner",
        },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException(
          "Cannot demote the last owner. Promote another member to owner first."
        );
      }
    }

    // Prevent non-owners from promoting to owner
    if (newRole === "owner" && ctx.membership.role !== "owner") {
      throw new ForbiddenException("Only owners can promote members to owner");
    }

    // Update the role
    const updated = await this.prisma.workspaceUser.update({
      where: { id: membershipId },
      data: { role: newRole },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
      },
    });

    // Audit log
    await this.auditService.record(ctx, {
      action: "member.role_updated",
      entityType: "workspace_member",
      entityId: membershipId,
      metadata: {
        targetUserId: membership.userId,
        targetUserEmail: membership.user.email,
        oldRole: membership.role,
        newRole: newRole,
      },
    });

    return {
      id: updated.id,
      role: updated.role,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      user: updated.user,
    };
  }
}
