import OpenAI from "openai";
import { Injectable } from "@nestjs/common";

@Injectable()
export class OpenAIService {
  private client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  getClient() {
    return this.client;
  }

  async createEmbedding(text: string) {
    return this.client.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
  }
}
