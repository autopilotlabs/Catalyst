import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditModule } from "../../audit/audit.module";
import { BillingModule } from "../../billing/billing.module";
import { ObservabilityModule } from "../../observability/observability.module";
import { AgentVersionService } from "./agent-version.service";
import { AgentVersionController } from "./agent-version.controller";

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    BillingModule,
    ObservabilityModule,
  ],
  controllers: [AgentVersionController],
  providers: [AgentVersionService],
  exports: [AgentVersionService],
})
export class AgentVersionModule {}
