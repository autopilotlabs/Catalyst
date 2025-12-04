import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditModule } from "../../audit/audit.module";
import { BillingModule } from "../../billing/billing.module";
import { ObservabilityModule } from "../../observability/observability.module";
import { ModelVersionService } from "./model-version.service";
import { ModelVersionController } from "./model-version.controller";

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    BillingModule,
    ObservabilityModule,
  ],
  controllers: [ModelVersionController],
  providers: [ModelVersionService],
  exports: [ModelVersionService],
})
export class ModelVersionModule {}
