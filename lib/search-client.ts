export interface SearchResult {
  entityType: string;
  entityId: string;
  title: string;
  snippet: string;
  score: number;
}

export async function searchWorkspace(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      console.error("Search request failed:", response.statusText);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error("Search failed:", error);
    return [];
  }
}

export function formatResult(result: SearchResult): {
  title: string;
  description: string;
  link: string;
} {
  const entityRoutes: Record<string, string> = {
    agent: "/agents",
    workflow: "/workflows",
    memory: "/memory",
    run: "/runs",
    plugin: "/plugins",
    trigger: "/triggers",
    audit: "/audit",
  };

  const baseRoute = entityRoutes[result.entityType] || "/";
  const link = result.entityType === "audit" ? baseRoute : `${baseRoute}/${result.entityId}`;

  return {
    title: result.title,
    description: result.snippet,
    link,
  };
}
