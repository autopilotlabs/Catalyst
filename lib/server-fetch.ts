import "server-only";
import { getAuthContext } from "./auth-context";
import { fetchWithRateLimitHandling } from "./fetch-with-handling";

/**
 * Authenticated API fetch with automatic workspace context headers
 * Combines auth context resolution with rate limit handling
 * Use this for all server-side API calls that require authentication
 * 
 * NOTE: This is a server-only function. Do not import in client components.
 */
export async function authedApiFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const ctx = await getAuthContext();

  const headers = {
    ...(init?.headers || {}),
    "x-user-id": ctx.userId,
    "x-workspace-id": ctx.workspaceId,
    "x-role": ctx.membership.role,
  };

  return fetchWithRateLimitHandling(url, {
    ...init,
    headers,
  });
}

/**
 * Authenticated API fetch returning JSON
 * Combines auth context resolution with rate limit handling
 * 
 * NOTE: This is a server-only function. Do not import in client components.
 */
export async function authedApiFetchJson<T = any>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const response = await authedApiFetch(url, init);
  return response.json();
}
