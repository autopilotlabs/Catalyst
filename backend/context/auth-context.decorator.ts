import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthContextData } from "./auth-context.interface";

export const AuthContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthContextData => {
    const request = ctx.switchToHttp().getRequest();

    // The guard already populated request.authContext
    return request.authContext;
  }
);
