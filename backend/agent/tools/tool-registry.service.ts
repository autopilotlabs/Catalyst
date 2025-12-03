import { Injectable } from "@nestjs/common";
import { Tool } from "./tool.interface";
import { DatabaseQueryTool } from "./database-query.tool";
import { WebSearchTool } from "./web-search.tool";

@Injectable()
export class ToolRegistryService {
  private tools = new Map<string, Tool>();

  constructor(
    private readonly databaseQueryTool: DatabaseQueryTool,
    private readonly webSearchTool: WebSearchTool
  ) {
    this.registerTool(databaseQueryTool);
    this.registerTool(webSearchTool);
  }

  registerTool(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getToolDefinitions() {
    return this.getAllTools().map(tool => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }
}
