import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface PluginToolDefinition {
  pluginId: string;
  toolId: string;
  name: string;
  description: string | null;
  parameters: any;
  code: string;
}

@Injectable()
export class PluginRegistryService {
  private readonly logger = new Logger(PluginRegistryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getWorkspaceTools(
    workspaceId: string
  ): Promise<PluginToolDefinition[]> {
    this.logger.log(`Loading plugin tools for workspace: ${workspaceId}`);

    try {
      const plugins = await this.prisma.plugin.findMany({
        where: {
          workspaceId,
          enabled: true,
        },
        include: {
          tools: true,
        },
      });

      const tools = plugins.flatMap((plugin) =>
        plugin.tools.map((t) => ({
          pluginId: plugin.id,
          toolId: t.id,
          name: t.name,
          description: t.description,
          parameters: t.parameters,
          code: t.code,
        }))
      );

      this.logger.log(
        `Loaded ${tools.length} plugin tools for workspace ${workspaceId}`
      );

      return tools;
    } catch (error: any) {
      this.logger.error(
        `Error loading plugin tools: ${error.message}`,
        error.stack
      );
      return [];
    }
  }

  async getWorkspaceToolDefinitions(workspaceId: string): Promise<any[]> {
    const tools = await this.getWorkspaceTools(workspaceId);

    return tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description || "Plugin tool",
        parameters: t.parameters,
      },
    }));
  }

  async getToolByName(
    workspaceId: string,
    toolName: string
  ): Promise<PluginToolDefinition | null> {
    const tools = await this.getWorkspaceTools(workspaceId);
    return tools.find((t) => t.name === toolName) || null;
  }
}
