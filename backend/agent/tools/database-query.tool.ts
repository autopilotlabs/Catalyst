import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Tool } from "./tool.interface";

@Injectable()
export class DatabaseQueryTool implements Tool {
  name = "database_query";
  description = "Execute a read-only SQL query on the workspace database";
  parameters = {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "SQL query to execute (SELECT only)",
      },
    },
    required: ["query"],
  };

  constructor(private readonly prisma: PrismaService) {}

  async execute(ctx: any, args: { query: string }) {
    const q = args.query.trim().toUpperCase();
    if (!q.startsWith("SELECT")) {
      throw new Error("Only SELECT queries are allowed");
    }

    const result = await this.prisma.$queryRawUnsafe(args.query);
    return {
      rows: result,
      count: Array.isArray(result) ? result.length : 0,
    };
  }
}
