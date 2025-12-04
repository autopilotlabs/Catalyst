import { SetMetadata } from "@nestjs/common";

export const RATE_LIMIT_KEY = "rate_limit";

export interface RateLimitMetadata {
  key: string;
  limit: number;
}

/**
 * Decorator to apply rate limiting to a controller method
 * @param key Rate limit key (e.g., "agent.run", "workflow.run")
 * @param limit Maximum requests per minute
 */
export const RateLimit = (key: string, limit: number) =>
  SetMetadata(RATE_LIMIT_KEY, { key, limit } as RateLimitMetadata);
