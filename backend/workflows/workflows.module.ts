import { Module, forwardRef } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AgentModule } from "../agent/agent.module";
import { WorkflowExecutionService } from "./workflow-execution.service";
import { WorkflowController } from "./workflow.controller";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [PrismaModule, AgentModule, forwardRef(() => AuditModule)],
  providers: [WorkflowExecutionService],
  controllers: [WorkflowController],
  exports: [WorkflowExecutionService],
})
export class WorkflowsModule {}
