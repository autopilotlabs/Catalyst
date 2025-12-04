import { Controller, Post, Body, UseGuards, Get, Query } from "@nestjs/common";
import { MemoryService } from "./memory.service";
import { AuthContext } from "../../context/auth-context.decorator";
import { AuthContextGuard } from "../../context/auth-context.guard";
import { PermissionsGuard } from "../../guards/permissions.guard";
import { RateLimitGuard } from "../../guards/rate-limit.guard";
import { WorkspaceLimitGuard, CheckLimit } from "../../guards/workspace-limit.guard";
import { RequirePermission } from "../../auth/permissions.decorator";
import { RateLimit } from "../../rate-limit/rate-limit.decorator";
import { RATE_KEY_MEMORY } from "../../rate-limit/rate-limit.service";
import { AuthContextData } from "../../context/auth-context.interface";

@Controller("memory")
@UseGuards(AuthContextGuard, PermissionsGuard, RateLimitGuard, WorkspaceLimitGuard)
@RequirePermission("workspace.memory")
export class MemoryController {
  constructor(private readonly memory: MemoryService) {}

  @Post("search")
  @RateLimit(RATE_KEY_MEMORY, 200)
  async search(
    @Body("query") query: string,
    @Body("limit") limit: number,
    @AuthContext() ctx: AuthContextData
  ) {
    return this.memory.searchMemory(ctx, query, limit || 5);
  }

  @Post("store")
  @RateLimit(RATE_KEY_MEMORY, 200)
  @CheckLimit("memory")
  async store(
    @Body("content") content: string,
    @AuthContext() ctx: AuthContextData
  ) {
    return this.memory.storeMemory(ctx, content);
  }

  @Get("recent")
  @RateLimit(RATE_KEY_MEMORY, 200)
  async recent(
    @Query("limit") limit: string,
    @AuthContext() ctx: AuthContextData
  ) {
    return this.memory.getRecentMemories(ctx, parseInt(limit) || 10);
  }
}
