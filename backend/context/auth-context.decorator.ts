import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthContextData } from "./auth-context.interface";

export const AuthContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthContextData => {
    const request = ctx.switchToHttp().getRequest();

    return {
      userId: request.headers["x-user-id"] as string,
      workspaceId: request.headers["x-workspace-id"] as string,
      role: request.headers["x-role"] as string,
    };
  }
);
