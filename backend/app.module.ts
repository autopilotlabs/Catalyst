import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ProtectedModule } from './protected/protected.module';
import { AgentModule } from './agent/agent.module';
import { OpenAIModule } from './openai/openai.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { EventsModule } from './events/events.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuditModule } from './audit/audit.module';
import { BillingModule } from './billing/billing.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { SearchModule } from './search/search.module';
import { UserModule } from './user/user.module';
import { NotificationsModule } from './notifications/notifications.module';
import { EventBusService } from './events/event-bus.service';
import { EventTriggerService } from './events/event-trigger.service';

@Module({
  imports: [
    PrismaModule,
    OpenAIModule,
    ProtectedModule,
    AgentModule,
    SchedulerModule,
    EventsModule,
    WorkflowsModule,
    AnalyticsModule,
    AuditModule,
    BillingModule,
    WorkspaceModule,
    SearchModule,
    UserModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly eventTriggerService: EventTriggerService
  ) {
    // Register event trigger service as a listener to the event bus
    this.eventBus.registerListener((event) =>
      this.eventTriggerService.handleIncomingEvent(event)
    );
  }
}

