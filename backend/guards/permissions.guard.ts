import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasPermission, PermissionCategory } from "../auth/permissions";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get permission metadata from decorator
    const requiredPermission = this.reflector.get<string>(
      "permission",
      context.getHandler()
    );

    // If no permission metadata, allow access
    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authContext = request.authContext;

    if (!authContext) {
      throw new ForbiddenException("Auth context not found");
    }

    const { role } = authContext;

    // Extract category from permission string (e.g., "workspace.analytics" -> "analytics")
    const parts = requiredPermission.split(".");
    if (parts.length !== 2 || parts[0] !== "workspace") {
      throw new ForbiddenException("Invalid permission format");
    }

    const category = parts[1] as PermissionCategory;

    // Check if user has permission
    if (!hasPermission(role, category)) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredPermission}, Role: ${role}`
      );
    }

    return true;
  }
}
