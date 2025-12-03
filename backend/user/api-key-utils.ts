import { randomBytes, createHash } from "crypto";

/**
 * Generate a secure random API key
 * Returns a 64-character hex string
 */
export function generateApiKey(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Hash an API key using SHA-256
 * @param apiKey - The plain text API key
 * @returns The hashed API key (hex string)
 */
export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

/**
 * Get the last 4 characters of an API key for display
 * @param apiKey - The plain text API key
 * @returns The last 4 characters
 */
export function getApiKeyLast4(apiKey: string): string {
  return apiKey.slice(-4);
}
