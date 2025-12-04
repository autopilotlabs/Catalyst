import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthContextGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const userId = request.headers["x-user-id"];
    let workspaceId = request.headers["x-workspace-id"] as string | undefined;
    const isApiKey = request.headers["x-api-key"];

    // Validate userId
    if (!userId) {
      throw new UnauthorizedException("Missing x-user-id header");
    }

    // Skip workspace resolution for API keys (handled by ApiKeyGuard)
    if (isApiKey) {
      // Workspace should be provided in header for API keys
      if (!workspaceId) {
        throw new BadRequestException("No workspace selected");
      }

      // Verify workspace membership
      const membership = await this.prisma.workspaceUser.findUnique({
        where: {
          userId_workspaceId: {
            userId: userId as string,
            workspaceId: workspaceId,
          },
        },
      });

      if (!membership) {
        throw new ForbiddenException("You are not a member of this workspace");
      }

      request.authContext = {
        userId,
        workspaceId,
        membership: {
          role: membership.role as 'owner' | 'admin' | 'member' | 'viewer',
        },
        isApiKey: true,
      };

      return true;
    }

    // For Clerk-authenticated users, resolve workspace from header or UserSettings
    if (!workspaceId) {
      // Try to load from UserSettings.defaultWorkspaceId
      const userSettings = await this.prisma.userSettings.findUnique({
        where: { userId: userId as string },
        select: { defaultWorkspaceId: true },
      });

      if (userSettings?.defaultWorkspaceId) {
        workspaceId = userSettings.defaultWorkspaceId;
      }
    }

    // If still no workspace, throw error
    if (!workspaceId) {
      throw new BadRequestException("No workspace selected");
    }

    // Verify workspace membership
    const membership = await this.prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: {
          userId: userId as string,
          workspaceId: workspaceId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException("You are not a member of this workspace");
    }

    // Attach validated context to request for downstream use
    request.authContext = {
      userId,
      workspaceId,
      membership: {
        role: membership.role as 'owner' | 'admin' | 'member' | 'viewer',
      },
    };

    return true;
  }
}
