import { Module } from "@nestjs/common";
import { WorkspaceCloneService } from "./workspace-clone.service";
import { WorkspaceCloneController } from "./workspace-clone.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { BillingModule } from "../billing/billing.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { JobModule } from "../jobs/job.module";

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    BillingModule,
    NotificationsModule,
    JobModule,
  ],
  providers: [WorkspaceCloneService],
  controllers: [WorkspaceCloneController],
  exports: [WorkspaceCloneService],
})
export class WorkspaceCloneModule {}
