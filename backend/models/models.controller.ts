import { Controller, Get, Post, Body, UseGuards } from "@nestjs/common";
import { AuthContextGuard } from "../context/auth-context.guard";
import { SubscriptionGuard } from "../guards/subscription.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { RateLimitGuard } from "../guards/rate-limit.guard";
import { WorkspaceLimitGuard, CheckLimit } from "../guards/workspace-limit.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { RateLimit } from "../rate-limit/rate-limit.decorator";
import { AuthContext } from "../context/auth-context.decorator";
import { AuthContextData } from "../context/auth-context.interface";
import { ModelRegistryService } from "./model-registry.service";
import { ModelGatewayService, InvokeChatParams } from "./model-gateway.service";

@Controller("models")
@UseGuards(AuthContextGuard, SubscriptionGuard, PermissionsGuard, RateLimitGuard, WorkspaceLimitGuard)
export class ModelsController {
  constructor(
    private readonly registry: ModelRegistryService,
    private readonly gateway: ModelGatewayService
  ) {}

  @Get()
  @RequirePermission("workspace.agents")
  async listModels() {
    const models = this.registry.getAll();
    return {
      data: models.map((model) => ({
        id: model.id,
        displayName: model.displayName,
        provider: model.provider,
        maxTokens: model.maxTokens,
        inputCostPer1K: model.inputCostPer1K,
        outputCostPer1K: model.outputCostPer1K,
      })),
    };
  }

  @Post("invoke")
  @RequirePermission("workspace.agents")
  @RateLimit("model.invoke", 120)
  @CheckLimit("monthlyTokens")
  async invokeModel(
    @AuthContext() ctx: AuthContextData,
    @Body() body: InvokeChatParams
  ) {
    const result = await this.gateway.invokeChat(ctx, body);
    return result;
  }
}
