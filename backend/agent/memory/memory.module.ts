import { Module, forwardRef } from "@nestjs/common";
import { MemoryService } from "./memory.service";
import { MemoryController } from "./memory.controller";
import { OpenAIModule } from "../../openai/openai.module";
import { RateLimitModule } from "../../rate-limit/rate-limit.module";
import { AuditModule } from "../../audit/audit.module";

@Module({
  imports: [OpenAIModule, RateLimitModule, forwardRef(() => AuditModule)],
  providers: [MemoryService],
  controllers: [MemoryController],
  exports: [MemoryService],
})
export class MemoryModule {}
