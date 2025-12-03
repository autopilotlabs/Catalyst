import { Module, forwardRef } from "@nestjs/common";
import { SchedulerService } from "./scheduler.service";
import { SchedulerController } from "./scheduler.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { AgentModule } from "../agent/agent.module";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [PrismaModule, AgentModule, forwardRef(() => AuditModule)],
  controllers: [SchedulerController],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
