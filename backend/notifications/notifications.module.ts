import { Module, forwardRef } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { RateLimitModule } from "../rate-limit/rate-limit.module";
import { AuditModule } from "../audit/audit.module";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [
    PrismaModule,
    RateLimitModule,
    AuditModule,
    forwardRef(() => RealtimeModule),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
