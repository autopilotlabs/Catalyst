import { Module, forwardRef } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AgentModule } from "../agent/agent.module";
import { RateLimitModule } from "../rate-limit/rate-limit.module";
import { BillingModule } from "../billing/billing.module";
import { EnvModule } from "../env/env.module";
import { WorkflowExecutionService } from "./workflow-execution.service";
import { WorkflowController } from "./workflow.controller";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [
    PrismaModule, 
    AgentModule, 
    RateLimitModule, 
    BillingModule, 
    forwardRef(() => AuditModule),
    forwardRef(() => EnvModule),
    forwardRef(() => require('../observability/observability.module').ObservabilityModule),
    forwardRef(() => require('../search/search.module').SearchModule),
  ],
  providers: [WorkflowExecutionService],
  controllers: [WorkflowController],
  exports: [WorkflowExecutionService],
})
export class WorkflowsModule {}
