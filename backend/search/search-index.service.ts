import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OpenAIService } from "../openai/openai.service";

export interface SearchResult {
  entityType: string;
  entityId: string;
  title: string;
  snippet: string;
  score: number;
}

@Injectable()
export class SearchIndexService {
  private readonly logger = new Logger(SearchIndexService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAIService
  ) {}

  async indexEntity(
    workspaceId: string,
    entityType: string,
    entityId: string,
    content: string
  ): Promise<void> {
    try {
      // Generate embedding using OpenAI
      let embedding: Buffer | null = null;
      
      try {
        const embeddingResponse = await this.openai.createEmbedding(content);
        const floatArray = embeddingResponse.data[0].embedding;
        
        // Convert float array to Buffer
        const buffer = Buffer.alloc(floatArray.length * 4);
        floatArray.forEach((value, index) => {
          buffer.writeFloatLE(value, index * 4);
        });
        embedding = buffer;
      } catch (error: any) {
        this.logger.warn(
          `Failed to generate embedding for ${entityType}:${entityId}: ${error.message}`
        );
        // Continue without embedding - keyword search will still work
      }

      // Upsert to search index
      const id = Math.random().toString(36).substring(2, 15);
      await this.prisma.$executeRaw`
        INSERT INTO "SearchIndex" ("id", "workspaceId", "entityType", "entityId", "content", "embedding", "createdAt", "updatedAt")
        VALUES (${id}, ${workspaceId}, ${entityType}, ${entityId}, ${content}, ${embedding}, NOW(), NOW())
        ON CONFLICT ("workspaceId", "entityType", "entityId") 
        DO UPDATE SET "content" = ${content}, "embedding" = ${embedding}, "updatedAt" = NOW()
      `;

      this.logger.debug(`Indexed ${entityType}:${entityId}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to index ${entityType}:${entityId}: ${error.message}`,
        error.stack
      );
    }
  }

  async removeEntity(
    workspaceId: string,
    entityType: string,
    entityId: string
  ): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        DELETE FROM "SearchIndex" 
        WHERE "workspaceId" = ${workspaceId} 
        AND "entityType" = ${entityType} 
        AND "entityId" = ${entityId}
      `;

      this.logger.debug(`Removed ${entityType}:${entityId} from index`);
    } catch (error: any) {
      this.logger.error(
        `Failed to remove ${entityType}:${entityId} from index: ${error.message}`
      );
    }
  }

  async search(
    workspaceId: string,
    query: string,
    limit: number = 20
  ): Promise<SearchResult[]> {
    try {
      // Get query embedding for semantic search
      let queryEmbedding: Float32Array | null = null;
      
      try {
        const embeddingResponse = await this.openai.createEmbedding(query);
        queryEmbedding = new Float32Array(embeddingResponse.data[0].embedding);
      } catch (error: any) {
        this.logger.warn(`Failed to generate query embedding: ${error.message}`);
      }

      // Fetch all indexed items for this workspace using raw SQL
      const indexedItems = await this.prisma.$queryRaw<Array<{
        id: string;
        workspaceId: string;
        entityType: string;
        entityId: string;
        content: string;
        embedding: Buffer | null;
      }>>` 
        SELECT "id", "workspaceId", "entityType", "entityId", "content", "embedding"
        FROM "SearchIndex"
        WHERE "workspaceId" = ${workspaceId}
        LIMIT 1000
      `;

      // Score each result
      const results = indexedItems.map((item) => {
        let score = 0;

        // Keyword matching (case-insensitive)
        const contentLower = item.content.toLowerCase();
        const queryLower = query.toLowerCase();
        
        if (contentLower.includes(queryLower)) {
          score += 0.5;
        }

        // Word matching
        const queryWords = queryLower.split(/\s+/);
        const matchedWords = queryWords.filter((word) =>
          contentLower.includes(word)
        ).length;
        score += (matchedWords / queryWords.length) * 0.3;

        // Semantic similarity (cosine similarity)
        if (queryEmbedding && item.embedding) {
          try {
            const docEmbedding = this.bufferToFloatArray(item.embedding);
            const similarity = this.cosineSimilarity(queryEmbedding, docEmbedding);
            score += similarity * 0.7;
          } catch (error) {
            // Skip semantic scoring if buffer conversion fails
          }
        }

        return {
          ...item,
          score,
        };
      });

      // Sort by score and filter low scores
      const sortedResults = results
        .filter((r) => r.score > 0.1)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // Format results
      return sortedResults.map((r) => ({
        entityType: r.entityType,
        entityId: r.entityId,
        title: this.extractTitle(r.content),
        snippet: this.extractSnippet(r.content, query),
        score: r.score,
      }));
    } catch (error: any) {
      this.logger.error(`Search failed: ${error.message}`, error.stack);
      return [];
    }
  }

  private bufferToFloatArray(buffer: Buffer): Float32Array {
    const floatArray = new Float32Array(buffer.length / 4);
    for (let i = 0; i < floatArray.length; i++) {
      floatArray[i] = buffer.readFloatLE(i * 4);
    }
    return floatArray;
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  private extractTitle(content: string): string {
    // Try to extract first line or first sentence
    const lines = content.split("\n");
    const firstLine = lines[0].trim();
    
    if (firstLine.length > 0 && firstLine.length < 100) {
      return firstLine;
    }

    // Return first 60 characters
    return content.substring(0, 60).trim() + (content.length > 60 ? "..." : "");
  }

  private extractSnippet(content: string, query: string): string {
    const maxLength = 150;
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();

    // Try to find query in content
    const index = contentLower.indexOf(queryLower);
    
    if (index !== -1) {
      // Extract surrounding context
      const start = Math.max(0, index - 50);
      const end = Math.min(content.length, index + query.length + 100);
      let snippet = content.substring(start, end);
      
      if (start > 0) snippet = "..." + snippet;
      if (end < content.length) snippet = snippet + "...";
      
      return snippet.trim();
    }

    // Return beginning of content
    return content.substring(0, maxLength).trim() + (content.length > maxLength ? "..." : "");
  }

  /**
   * Run job handler for background queue - async indexing
   */
  async runJob(job: any, payload: any): Promise<void> {
    this.logger.log(`Executing search index job: ${job.id}`);

    const { workspaceId, entityType, entityId, content } = payload;

    // Index the entity
    await this.indexEntity(workspaceId, entityType, entityId, content);
  }
}
