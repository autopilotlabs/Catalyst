import { Module } from "@nestjs/common";
import { RateLimitService } from "./rate-limit.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitModule {}
