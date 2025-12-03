import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuthContextGuard } from "../context/auth-context.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { AuthContext } from "../context/auth-context.decorator";
import { AuthContextData } from "../context/auth-context.interface";

@Controller("audit")
@UseGuards(AuthContextGuard, PermissionsGuard)
@RequirePermission("workspace.audit")
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  @Get()
  async list(
    @AuthContext() ctx: AuthContextData,
    @Query("entityType") entityType?: string,
    @Query("action") action?: string,
    @Query("limit") limitStr?: string,
    @Query("cursor") cursor?: string
  ) {
    // Parse and validate limit
    const limit = Math.min(parseInt(limitStr || "50", 10), 200);

    // Build where clause
    const where: any = {
      workspaceId: ctx.workspaceId,
    };

    if (entityType) {
      where.entityType = entityType;
    }

    if (action) {
      where.action = action;
    }

    // Build cursor clause if provided
    const cursorClause = cursor ? { id: cursor } : undefined;

    // Fetch logs with pagination
    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1, // Fetch one extra to determine if there are more
      cursor: cursorClause ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0, // Skip the cursor itself
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Determine if there are more results
    const hasMore = logs.length > limit;
    const data = hasMore ? logs.slice(0, limit) : logs;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return {
      data,
      nextCursor,
    };
  }
}
