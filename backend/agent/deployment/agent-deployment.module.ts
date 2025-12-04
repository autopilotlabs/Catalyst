import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditModule } from "../../audit/audit.module";
import { BillingModule } from "../../billing/billing.module";
import { ObservabilityModule } from "../../observability/observability.module";
import { AgentDeploymentService } from "./agent-deployment.service";
import { AgentDeploymentController } from "./agent-deployment.controller";

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    BillingModule,
    ObservabilityModule,
  ],
  controllers: [AgentDeploymentController],
  providers: [AgentDeploymentService],
  exports: [AgentDeploymentService],
})
export class AgentDeploymentModule {}
