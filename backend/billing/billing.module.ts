import { Module, forwardRef } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { StripeService } from "./stripe.service";
import { BillingController } from "./billing.controller";
import { StripeWebhookController } from "./stripe-webhook.controller";

@Module({
  imports: [PrismaModule, forwardRef(() => AuditModule)],
  providers: [StripeService],
  controllers: [BillingController, StripeWebhookController],
  exports: [StripeService],
})
export class BillingModule {}
