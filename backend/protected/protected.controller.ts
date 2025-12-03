import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthContext } from "../context/auth-context.decorator";
import { AuthContextGuard } from "../context/auth-context.guard";
import { AuthContextData } from "../context/auth-context.interface";

@Controller("protected")
export class ProtectedController {
  @UseGuards(AuthContextGuard)
  @Get()
  test(@AuthContext() ctx: AuthContextData) {
    return {
      success: true,
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      role: ctx.role,
    };
  }
}
