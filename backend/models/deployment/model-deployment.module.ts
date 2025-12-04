import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditModule } from "../../audit/audit.module";
import { BillingModule } from "../../billing/billing.module";
import { ObservabilityModule } from "../../observability/observability.module";
import { ModelDeploymentService } from "./model-deployment.service";
import { ModelDeploymentController } from "./model-deployment.controller";

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    BillingModule,
    ObservabilityModule,
  ],
  controllers: [ModelDeploymentController],
  providers: [ModelDeploymentService],
  exports: [ModelDeploymentService],
})
export class ModelDeploymentModule {}
