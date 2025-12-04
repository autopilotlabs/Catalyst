import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { OpenAIModule } from "../openai/openai.module";
import { AnalyticsModule } from "../analytics/analytics.module";
import { BillingModule } from "../billing/billing.module";
import { ModelRegistryService } from "./model-registry.service";
import { ModelGatewayService } from "./model-gateway.service";
import { ModelsController } from "./models.controller";

@Module({
  imports: [PrismaModule, OpenAIModule, AnalyticsModule, BillingModule],
  providers: [ModelRegistryService, ModelGatewayService],
  controllers: [ModelsController],
  exports: [ModelRegistryService, ModelGatewayService],
})
export class ModelsModule {}
