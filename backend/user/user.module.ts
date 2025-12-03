import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { UserSettingsService } from "./user-settings.service";
import { UserSettingsController } from "./user-settings.controller";

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [UserSettingsController],
  providers: [UserSettingsService],
  exports: [UserSettingsService],
})
export class UserModule {}
