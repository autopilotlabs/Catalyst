import { Injectable, NotFoundException } from "@nestjs/common";

export interface ModelConfig {
  id: string;
  provider: string;
  displayName: string;
  maxTokens: number;
  inputCostPer1K: number;
  outputCostPer1K: number;
}

@Injectable()
export class ModelRegistryService {
  private readonly models: ModelConfig[] = [
    {
      id: "gpt-4o-mini",
      provider: "openai",
      displayName: "GPT-4o Mini",
      maxTokens: 16384,
      inputCostPer1K: 0.00015,
      outputCostPer1K: 0.0006,
    },
    {
      id: "gpt-4o",
      provider: "openai",
      displayName: "GPT-4o",
      maxTokens: 128000,
      inputCostPer1K: 0.0025,
      outputCostPer1K: 0.01,
    },
    {
      id: "gpt-4.1-mini",
      provider: "openai",
      displayName: "GPT-4.1 Mini",
      maxTokens: 128000,
      inputCostPer1K: 0.00015,
      outputCostPer1K: 0.0006,
    },
  ];

  getAll(): ModelConfig[] {
    return this.models;
  }

  getById(id: string): ModelConfig {
    const model = this.models.find((m) => m.id === id);
    if (!model) {
      throw new NotFoundException(`Model not found: ${id}`);
    }
    return model;
  }

  getDefaultModel(): ModelConfig {
    return this.models[0]; // gpt-4o-mini
  }

  estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const model = this.getById(modelId);
    const inputCost = (inputTokens / 1000) * model.inputCostPer1K;
    const outputCost = (outputTokens / 1000) * model.outputCostPer1K;
    return inputCost + outputCost;
  }
}
