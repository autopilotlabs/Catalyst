import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AuthContextGuard } from "../context/auth-context.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { SubscriptionGuard } from "../guards/subscription.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { AuthContext } from "../context/auth-context.decorator";
import { AuthContextData } from "../context/auth-context.interface";
import { SearchIndexService } from "./search-index.service";

@Controller("search")
@UseGuards(AuthContextGuard, SubscriptionGuard, PermissionsGuard)
@RequirePermission("workspace.agents")
export class SearchController {
  constructor(private readonly searchService: SearchIndexService) {}

  @Get()
  async search(
    @AuthContext() ctx: AuthContextData,
    @Query("q") query: string,
    @Query("limit") limitStr?: string
  ) {
    if (!query || query.trim().length === 0) {
      return { data: [] };
    }

    const limit = limitStr ? Math.min(parseInt(limitStr, 10), 50) : 20;
    
    const results = await this.searchService.search(
      ctx.workspaceId,
      query.trim(),
      limit
    );

    return { data: results };
  }
}
