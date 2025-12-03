import { Module, forwardRef } from "@nestjs/common";
import { AgentController } from "./agent.controller";
import { AgentService } from "./agent.service";
import { AgentExecutionService } from "./agent-execution.service";
import { OpenAIModule } from "../openai/openai.module";
import { MemoryModule } from "./memory/memory.module";
import { ToolRegistryService } from "./tools/tool-registry.service";
import { DatabaseQueryTool } from "./tools/database-query.tool";
import { WebSearchTool } from "./tools/web-search.tool";
import { StepLoggerService } from "./steps/step-logger.service";
import { AgentStateService } from "./state/state.service";
import { StateController } from "./state/state.controller";
import { AgentRegistryService } from "./registry/agent-registry.service";
import { AgentRegistryController } from "./registry/agent-registry.controller";
import { PluginRegistryService } from "./plugins/plugin-registry.service";
import { PluginExecutorService } from "./plugins/plugin-executor.service";
import { PluginController } from "./plugins/plugin.controller";
import { PluginToolController } from "./plugins/plugin-tool.controller";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [OpenAIModule, MemoryModule, forwardRef(() => AuditModule)],
  controllers: [
    AgentController,
    StateController,
    AgentRegistryController,
    PluginController,
    PluginToolController,
  ],
  providers: [
    AgentService,
    AgentExecutionService,
    ToolRegistryService,
    DatabaseQueryTool,
    WebSearchTool,
    StepLoggerService,
    AgentStateService,
    AgentRegistryService,
    PluginRegistryService,
    PluginExecutorService,
  ],
  exports: [AgentExecutionService],
})
export class AgentModule {}
