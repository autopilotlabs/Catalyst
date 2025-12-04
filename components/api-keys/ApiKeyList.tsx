"use client";

import { useState } from "react";
import { ApiKeyRow } from "./ApiKeyRow";
import { CreateApiKeyDialog } from "./CreateApiKeyDialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ApiKey {
  id: string;
  name: string;
  role: string;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

interface ApiKeyListProps {
  apiKeys: ApiKey[];
  onRefresh: () => void;
}

export function ApiKeyList({ apiKeys, onRefresh }: ApiKeyListProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Manage API keys for external integrations (Zapier, Make, n8n, custom apps)
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              Create API Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No API keys yet.</p>
              <p className="text-sm mt-2">
                Create an API key to integrate with external systems.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((apiKey) => (
                <ApiKeyRow key={apiKey.id} apiKey={apiKey} onRevoke={onRefresh} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateApiKeyDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreated={onRefresh}
      />
    </div>
  );
}
