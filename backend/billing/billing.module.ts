import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { BillingService } from "./billing.service";
import { InvoiceService } from "./invoice.service";
import { BillingController } from "./billing.controller";

@Module({
  imports: [
    PrismaModule,
    require('../observability/observability.module').ObservabilityModule,
  ],
  providers: [BillingService, InvoiceService],
  controllers: [BillingController],
  exports: [BillingService, InvoiceService],
})
export class BillingModule {}
