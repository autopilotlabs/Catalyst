import { Module } from "@nestjs/common";
import { EnvService } from "./env.service";
import { EnvCryptoService } from "./env-crypto.service";
import { EnvController } from "./env.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { ObservabilityModule } from "../observability/observability.module";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [PrismaModule, AuditModule, ObservabilityModule, BillingModule],
  providers: [EnvService, EnvCryptoService],
  controllers: [EnvController],
  exports: [EnvService],
})
export class EnvModule {}
