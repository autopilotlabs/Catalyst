import { Module } from "@nestjs/common";
import { MaintenanceService } from "./maintenance.service";
import { BillingModule } from "../billing/billing.module";
import { JobModule } from "../jobs/job.module";
import { PrismaModule } from "../prisma/prisma.module";
import { MaintenanceController } from "./maintenance.controller";

@Module({
  imports: [
    BillingModule, 
    JobModule, 
    PrismaModule,
    require('../observability/observability.module').ObservabilityModule,
  ],
  providers: [MaintenanceService],
  controllers: [MaintenanceController],
})
export class MaintenanceModule {}
