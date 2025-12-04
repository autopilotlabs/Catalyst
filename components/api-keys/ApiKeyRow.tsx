"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface ApiKeyRowProps {
  apiKey: ApiKey;
  onRevoke: () => void;
}

export function ApiKeyRow({ apiKey, onRevoke }: ApiKeyRowProps) {
  const [isRevoking, setIsRevoking] = useState(false);

  const handleRevoke = async () => {
    if (!confirm(`Are you sure you want to revoke "${apiKey.name}"?`)) {
      return;
    }

    setIsRevoking(true);

    try {
      // Get workspace context from headers
      const workspaceId = localStorage.getItem("workspaceId");
      const role = localStorage.getItem("role");

      await fetchJsonWithRateLimitHandling(`/api/api-keys/${apiKey.id}`, {
        method: "DELETE",
        headers: {
          "x-workspace-id": workspaceId || "",
          "x-role": role || "",
        },
      });

      toast.success("API key revoked");
      onRevoke();
    } catch (error: any) {
      toast.error("Failed to revoke API key", {
        description: error.message,
      });
    } finally {
      setIsRevoking(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const isExpired = apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date();

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{apiKey.name}</h3>
          <Badge variant={apiKey.role === "owner" ? "default" : "secondary"}>
            {apiKey.role}
          </Badge>
          {isExpired && <Badge variant="destructive">Expired</Badge>}
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          Created {formatDate(apiKey.createdAt)}
          {apiKey.expiresAt && (
            <span> • Expires {formatDate(apiKey.expiresAt)}</span>
          )}
        </div>
      </div>
      <Button
        variant="destructive"
        size="sm"
        onClick={handleRevoke}
        disabled={isRevoking}
      >
        {isRevoking ? "Revoking..." : "Revoke"}
      </Button>
    </div>
  );
}
