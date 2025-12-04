import { Module } from "@nestjs/common";
import { JobQueueService } from "./job-queue.service";
import { JobController } from "./job.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [
    PrismaModule, 
    AuditModule,
    require('../observability/observability.module').ObservabilityModule,
  ],
  controllers: [JobController],
  providers: [JobQueueService],
  exports: [JobQueueService],
})
export class JobModule {}
