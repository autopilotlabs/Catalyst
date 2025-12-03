import { Injectable } from "@nestjs/common";
import { Tool } from "./tool.interface";

@Injectable()
export class WebSearchTool implements Tool {
  name = "web_search";
  description = "Search the web for information (placeholder implementation)";
  parameters = {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "Search query",
      },
    },
    required: ["query"],
  };

  async execute(ctx: any, args: { query: string }) {
    return {
      results: [
        {
          title: "Example Result",
          url: "https://example.com",
          snippet: "This is a placeholder for real web search.",
        },
      ],
      message: "Web search tool is a placeholder. Integrate with Tavily or Serper later.",
    };
  }
}
