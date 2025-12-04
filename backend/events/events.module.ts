import { Module, forwardRef } from "@nestjs/common";
import { EventBusService } from "./event-bus.service";
import { EventTriggerService } from "./event-trigger.service";
import { EventController } from "./event.controller";
import { EventTriggerController } from "./event-trigger.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { AgentModule } from "../agent/agent.module";
import { RateLimitModule } from "../rate-limit/rate-limit.module";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [PrismaModule, AgentModule, RateLimitModule, forwardRef(() => AuditModule)],
  controllers: [EventController, EventTriggerController],
  providers: [EventBusService, EventTriggerService],
  exports: [EventBusService, EventTriggerService],
})
export class EventsModule {}
