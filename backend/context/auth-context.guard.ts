import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthContextGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const userId = request.headers["x-user-id"];
    const workspaceId = request.headers["x-workspace-id"];
    const role = request.headers["x-role"];

    // Validate required headers
    if (!userId || !workspaceId || !role) {
      throw new UnauthorizedException("Missing authentication headers");
    }

    // Verify workspace membership via Prisma
    const membership = await this.prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: {
          userId: userId as string,
          workspaceId: workspaceId as string,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException("User does not belong to this workspace");
    }

    // Attach validated context to request for downstream use
    request.authContext = {
      userId,
      workspaceId,
      role,
    };

    return true;
  }
}
