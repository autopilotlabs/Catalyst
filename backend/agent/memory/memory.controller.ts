import { Controller, Post, Body, UseGuards, Get, Query } from "@nestjs/common";
import { MemoryService } from "./memory.service";
import { AuthContext } from "../../context/auth-context.decorator";
import { AuthContextGuard } from "../../context/auth-context.guard";
import { PermissionsGuard } from "../../guards/permissions.guard";
import { RequirePermission } from "../../auth/permissions.decorator";
import { AuthContextData } from "../../context/auth-context.interface";

@Controller("memory")
@UseGuards(AuthContextGuard, PermissionsGuard)
@RequirePermission("workspace.memory")
export class MemoryController {
  constructor(private readonly memory: MemoryService) {}

  @Post("search")
  async search(
    @Body("query") query: string,
    @Body("limit") limit: number,
    @AuthContext() ctx: AuthContextData
  ) {
    return this.memory.searchMemory(ctx, query, limit || 5);
  }

  @Post("store")
  async store(
    @Body("content") content: string,
    @AuthContext() ctx: AuthContextData
  ) {
    return this.memory.storeMemory(ctx, content);
  }

  @Get("recent")
  async recent(
    @Query("limit") limit: string,
    @AuthContext() ctx: AuthContextData
  ) {
    return this.memory.getRecentMemories(ctx, parseInt(limit) || 10);
  }
}
