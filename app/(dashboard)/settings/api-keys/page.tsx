"use client";

import { useEffect, useState } from "react";
import { ApiKeyList } from "@/components/api-keys/ApiKeyList";
import { toast } from "sonner";
import { fetchJsonWithRateLimitHandling } from "@/lib/fetch-with-handling";

interface ApiKey {
  id: string;
  name: string;
  role: string;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchApiKeys = async () => {
    try {
      // Get workspace context from localStorage
      const workspaceId = localStorage.getItem("workspaceId");
      const role = localStorage.getItem("role");

      if (!workspaceId || !role) {
        toast.error("Missing workspace context");
        return;
      }

      const data = await fetchJsonWithRateLimitHandling<ApiKey[]>(
        "/api/api-keys",
        {
          headers: {
            "x-workspace-id": workspaceId,
            "x-role": role,
          },
        }
      );

      setApiKeys(data);
    } catch (error: any) {
      toast.error("Failed to fetch API keys", {
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApiKeys();
  }, []);

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">API Keys</h1>
          <p className="text-muted-foreground mt-2">
            Manage API keys for integrating with external systems like Zapier, Make, n8n, and custom applications.
          </p>
        </div>

        <ApiKeyList apiKeys={apiKeys} onRefresh={fetchApiKeys} />

        <div className="mt-8 p-6 border rounded-lg bg-muted/50">
          <h2 className="text-lg font-semibold mb-2">External API Endpoints</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Use these endpoints with your API key in the <code className="px-1 py-0.5 bg-background rounded">x-api-key</code> header:
          </p>
          <ul className="space-y-2 text-sm font-mono">
            <li>
              <code className="text-blue-600">POST /ext/agent/run</code> - Run an agent
            </li>
            <li>
              <code className="text-blue-600">POST /ext/workflow/trigger</code> - Trigger a workflow
            </li>
            <li>
              <code className="text-blue-600">POST /ext/memory/store</code> - Store a memory
            </li>
            <li>
              <code className="text-blue-600">POST /ext/memory/search</code> - Search memories
            </li>
            <li>
              <code className="text-blue-600">POST /ext/event/emit</code> - Emit an event
            </li>
          </ul>
        </div>

        <div className="mt-6 p-6 border rounded-lg bg-muted/50">
          <h2 className="text-lg font-semibold mb-2">Agent Deployments</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Run agents from specific deployments or environments:
          </p>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Using Deployment ID:</h3>
              <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
{`{
  "input": "your input here",
  "deploymentId": "dep_abc123"
}`}
              </pre>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Using Environment:</h3>
              <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
{`{
  "input": "your input here",
  "agentId": "agent_xyz789",
  "environment": "prod"
}`}
              </pre>
              <p className="text-xs text-muted-foreground mt-2">
                Valid environments: <code>dev</code>, <code>staging</code>, <code>prod</code>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 p-6 border rounded-lg bg-muted/50">
          <h2 className="text-lg font-semibold mb-2">Model Deployments</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Invoke models from specific deployments or environments:
          </p>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">POST /ext/models/generate - Using Deployment ID:</h3>
              <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
{`{
  "deploymentId": "dep_123",
  "messages": [
    { "role": "user", "content": "Write a poem..." }
  ]
}`}
              </pre>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Using Model ID + Environment:</h3>
              <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
{`{
  "modelId": "model_abc",
  "environment": "prod",
  "messages": [
    { "role": "user", "content": "Summarize this..." }
  ]
}`}
              </pre>
              <p className="text-xs text-muted-foreground mt-2">
                Valid environments: <code>dev</code>, <code>staging</code>, <code>prod</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
