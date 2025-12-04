import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AnalyticsModule } from "../analytics/analytics.module";
import { ModelsModule } from "../models/models.module";
import { JobModule } from "../jobs/job.module";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { BillingModule } from "../billing/billing.module";
import { EvalService } from "./eval.service";
import { EvalController } from "./eval.controller";

@Module({
  imports: [
    PrismaModule,
    AnalyticsModule,
    ModelsModule,
    JobModule,
    AuditModule,
    NotificationsModule,
    BillingModule,
  ],
  providers: [EvalService],
  controllers: [EvalController],
  exports: [EvalService],
})
export class EvalModule {}
