import { toast } from "sonner";

/**
 * Enhanced fetch wrapper with rate limit handling
 * Automatically shows user-friendly toasts for 429 errors
 */
export async function fetchWithRateLimitHandling(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const response = await fetch(url, options);

  // Handle 429 Too Many Requests
  if (response.status === 429) {
    const data = await response.json().catch(() => ({}));
    const retryAfter = data.retryAfter || 60;
    
    toast.error("Rate limit reached", {
      description: `Please wait ${retryAfter} seconds and try again.`,
      duration: 5000,
    });

    // Throw error to allow caller to handle it
    const error = new Error("Rate limit exceeded");
    (error as any).status = 429;
    (error as any).retryAfter = retryAfter;
    throw error;
  }

  // Handle other errors normally
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
    (error as any).status = response.status;
    (error as any).response = response;
    throw error;
  }

  return response;
}

/**
 * Fetch JSON with rate limit handling
 */
export async function fetchJsonWithRateLimitHandling<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetchWithRateLimitHandling(url, options);
  return response.json();
}

/**
 * Check if error is a rate limit error
 */
export function isRateLimitError(error: any): boolean {
  return error?.status === 429;
}

/**
 * Get retry after seconds from rate limit error
 */
export function getRetryAfter(error: any): number {
  return error?.retryAfter || 60;
}
