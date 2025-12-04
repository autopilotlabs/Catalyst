import { Module } from "@nestjs/common";
import { WorkspaceLimitService } from "./workspace-limit.service";
import { WorkspaceLimitController } from "./workspace-limit.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [PrismaModule, NotificationsModule, AuditModule],
  providers: [WorkspaceLimitService],
  controllers: [WorkspaceLimitController],
  exports: [WorkspaceLimitService],
})
export class WorkspaceLimitModule {}
