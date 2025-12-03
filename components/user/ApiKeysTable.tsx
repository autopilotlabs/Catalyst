"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";

interface ApiKey {
  id: string;
  name: string;
  last4: string;
  createdAt: string;
  expiresAt?: string | null;
  revoked: boolean;
}

interface ApiKeysTableProps {
  apiKeys: ApiKey[];
  onRevoke: (id: string) => Promise<void>;
  onCreateNew: () => void;
}

export function ApiKeysTable({
  apiKeys,
  onRevoke,
  onCreateNew,
}: ApiKeysTableProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">API Keys</h3>
        <Button onClick={onCreateNew}>Create API Key</Button>
      </div>

      {apiKeys.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No API keys yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell className="font-mono text-sm">
                    ••••{key.last4}
                  </TableCell>
                  <TableCell>{formatDate(key.createdAt)}</TableCell>
                  <TableCell>
                    {key.expiresAt ? formatDate(key.expiresAt) : "Never"}
                  </TableCell>
                  <TableCell>
                    {key.revoked ? (
                      <Badge variant="destructive">Revoked</Badge>
                    ) : (
                      <Badge>Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!key.revoked && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onRevoke(key.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
