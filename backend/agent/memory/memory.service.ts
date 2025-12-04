import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { OpenAIService } from "../../openai/openai.service";
import { SearchIndexService } from "../../search/search-index.service";
import { AuthContextData } from "../../context/auth-context.interface";
import { AuditService } from "../../audit/audit.service";

@Injectable()
export class MemoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openaiService: OpenAIService,
    private readonly auditService: AuditService,
    private readonly searchIndex: SearchIndexService,
    @Inject(forwardRef(() => require('../../observability/observability.service').ObservabilityService))
    private readonly observability: any
  ) {}

  async embed(text: string): Promise<number[]> {
    const client = this.openaiService.getClient();
    const response = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
  }

  async storeMemory(ctx: AuthContextData, content: string) {
    const startTime = Date.now();
    const embedding = await this.embed(content);
    const memory = await this.prisma.agentMemory.create({
      data: {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        content,
        embedding,
      },
    });

    // Index for global search
    await this.searchIndex.indexEntity(ctx.workspaceId, 'memory', memory.id, content);

    // Audit log for memory stored
    await this.auditService.logMemoryEvent(ctx, {
      action: "memory.stored",
      entityType: "memory",
      entityId: memory.id,
      metadata: {
        snippet: content.substring(0, 100),
      },
    });

    // Log observability event
    const duration = Date.now() - startTime;
    if (this.observability?.logEvent) {
      await this.observability.logEvent(ctx, {
        category: "memory",
        eventType: "memory.store",
        entityId: memory.id,
        entityType: "memory",
        durationMs: duration,
        success: true,
      });
    }

    return memory;
  }

  async searchMemory(ctx: AuthContextData, query: string, limit = 5) {
    try {
      const startTime = Date.now();
      const embedding = await this.embed(query);
      const embeddingArray = `[${embedding.join(",")}]`;
      
      // pgvector similarity search using cosine distance operator
      const results = await this.prisma.$queryRawUnsafe<Array<{ id: string; content: string }>>(`
        SELECT id, content
        FROM "AgentMemory"
        WHERE "workspaceId" = '${ctx.workspaceId}'
        ORDER BY embedding <-> '${embeddingArray}'::vector
        LIMIT ${limit}
      `);

      // Audit log for memory search
      await this.auditService.logMemoryEvent(ctx, {
        action: "memory.searched",
        entityType: "memory",
        metadata: {
          query: query.substring(0, 100),
          resultsCount: results.length,
        },
      });

      // Log observability event
      const duration = Date.now() - startTime;
      if (this.observability?.logEvent) {
        await this.observability.logEvent(ctx, {
          category: "memory",
          eventType: "memory.search",
          durationMs: duration,
          success: true,
          metadata: { resultsCount: results.length },
        });
      }

      return results;
    } catch (error) {
      // Fallback to recent memories if vector search fails
      console.error("Vector search failed, falling back to recent memories:", error);
      const recent = await this.getRecentMemories(ctx, limit);
      return recent.map(m => ({ id: m.id, content: m.content }));
    }
  }

  async getRecentMemories(ctx: AuthContextData, limit = 10) {
    return this.prisma.agentMemory.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Run job handler for background queue - embedding generation
   */
  async runEmbeddingJob(job: any, payload: any): Promise<void> {
    // Stub for future async embedding if needed
    // Currently embeddings are generated synchronously in storeMemory
    return Promise.resolve();
  }
}
