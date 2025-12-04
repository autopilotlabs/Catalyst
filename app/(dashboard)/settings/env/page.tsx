"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus, AlertTriangle } from "lucide-react";
import { EnvList } from "@/components/env/EnvList";
import { EnvEditorDialog } from "@/components/env/EnvEditorDialog";
import { toast } from "sonner";

interface EnvVar {
  id: string;
  name: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export default function EnvironmentVariablesPage() {
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadEnvVars = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/env");
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch environment variables");
      }

      const data = await res.json();
      setEnvVars(data.data || []);
    } catch (error: any) {
      toast.error("Failed to load environment variables", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEnvVars();
  }, []);

  const handleDelete = async (name: string) => {
    try {
      const res = await fetch(`/api/env/${name}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete environment variable");
      }

      toast.success("Environment variable deleted successfully");
      loadEnvVars();
    } catch (error: any) {
      toast.error("Failed to delete environment variable", {
        description: error.message,
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Environment Variables</h1>
        <p className="text-gray-600">
          Manage encrypted environment variables for your workspace
        </p>
      </div>

      <Card className="border-amber-500 bg-amber-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-amber-900">Important</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-amber-800">
          <p>
            Environment variables are encrypted at rest using AES-256-GCM encryption.
            Only Owners and Admins can view or modify their values. These variables
            are automatically injected into agent executions, workflows, and model invocations.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Variables</CardTitle>
              <CardDescription>
                {envVars.length} variable{envVars.length !== 1 ? "s" : ""} configured
              </CardDescription>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Variable
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading environment variables...
            </div>
          ) : (
            <EnvList
              envVars={envVars}
              onDelete={handleDelete}
              onRefresh={loadEnvVars}
            />
          )}
        </CardContent>
      </Card>

      <EnvEditorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={loadEnvVars}
      />
    </div>
  );
}
