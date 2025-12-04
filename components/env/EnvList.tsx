"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface EnvVar {
  id: string;
  name: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface EnvListProps {
  envVars: EnvVar[];
  onDelete: (name: string) => void;
  onRefresh: () => void;
}

export function EnvList({ envVars, onDelete, onRefresh }: EnvListProps) {
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({});
  const [loadingValues, setLoadingValues] = useState<Record<string, boolean>>({});

  const handleReveal = async (name: string) => {
    if (revealedValues[name]) {
      // Hide the value
      const newRevealed = { ...revealedValues };
      delete newRevealed[name];
      setRevealedValues(newRevealed);
      return;
    }

    setLoadingValues({ ...loadingValues, [name]: true });

    try {
      const res = await fetch(`/api/env/${name}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch value");
      }

      const data = await res.json();
      setRevealedValues({ ...revealedValues, [name]: data.data.value });
    } catch (error: any) {
      toast.error("Failed to reveal value", {
        description: error.message,
      });
    } finally {
      setLoadingValues({ ...loadingValues, [name]: false });
    }
  };

  const handleDelete = (name: string) => {
    if (confirm(`Are you sure you want to delete the environment variable "${name}"?`)) {
      onDelete(name);
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Last Updated</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {envVars.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No environment variables found. Create one to get started.
              </TableCell>
            </TableRow>
          ) : (
            envVars.map((envVar) => (
              <TableRow key={envVar.id}>
                <TableCell className="font-mono font-medium">{envVar.name}</TableCell>
                <TableCell>
                  {revealedValues[envVar.name] ? (
                    <span className="font-mono text-sm">{revealedValues[envVar.name]}</span>
                  ) : (
                    <span className="text-muted-foreground">••••••••</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">v{envVar.version}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(envVar.updatedAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReveal(envVar.name)}
                    disabled={loadingValues[envVar.name]}
                  >
                    {revealedValues[envVar.name] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(envVar.name)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
