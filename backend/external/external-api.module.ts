import { Module } from "@nestjs/common";
import { ExternalApiController } from "./external-api.controller";
import { ApiKeyModule } from "../api-keys/api-key.module";
import { RateLimitModule } from "../rate-limit/rate-limit.module";
import { AgentModule } from "../agent/agent.module";
import { EventsModule } from "../events/events.module";
import { AuditModule } from "../audit/audit.module";
import { ModelsModule } from "../models/models.module";
import { FileStorageModule } from "../storage/file-storage.module";

@Module({
  imports: [
    ApiKeyModule,
    RateLimitModule,
    AgentModule,
    EventsModule,
    AuditModule,
    ModelsModule,
    FileStorageModule,
  ],
  controllers: [ExternalApiController],
})
export class ExternalApiModule {}
