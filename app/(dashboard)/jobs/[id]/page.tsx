"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { fetchJsonWithRateLimitHandling } from "@/lib/fetch-with-handling";

interface Job {
  id: string;
  workspaceId: string;
  type: string;
  payload: any;
  status: string;
  attempts: number;
  maxAttempts: number;
  scheduledAt: string;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);

  const fetchJob = async () => {
    try {
      const workspaceId = localStorage.getItem("workspaceId");
      const role = localStorage.getItem("role");

      if (!workspaceId || !role) {
        toast.error("Missing workspace context");
        return;
      }

      const data = await fetchJsonWithRateLimitHandling<Job>(
        `/api/jobs/${params.id}`,
        {
          headers: {
            "x-workspace-id": workspaceId,
            "x-role": role,
          },
        }
      );

      setJob(data);
    } catch (error: any) {
      toast.error("Failed to fetch job", {
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!job) return;

    setIsRetrying(true);

    try {
      const workspaceId = localStorage.getItem("workspaceId");
      const role = localStorage.getItem("role");

      await fetchJsonWithRateLimitHandling(`/api/jobs/${job.id}/retry`, {
        method: "POST",
        headers: {
          "x-workspace-id": workspaceId || "",
          "x-role": role || "",
        },
      });

      toast.success("Job queued for retry");
      fetchJob();
    } catch (error: any) {
      toast.error("Failed to retry job", {
        description: error.message,
      });
    } finally {
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    fetchJob();
  }, [params.id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-500";
      case "running":
        return "bg-blue-500";
      case "pending":
        return "bg-yellow-500";
      case "failed":
        return "bg-orange-500";
      case "dead":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Job not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => router.push("/jobs")}
              className="mb-4"
            >
              ← Back to Jobs
            </Button>
            <h1 className="text-3xl font-bold">Job Details</h1>
            <p className="text-muted-foreground mt-2 font-mono text-sm">
              {job.id}
            </p>
          </div>
          {(job.status === "dead" || job.status === "failed") && (
            <Button onClick={handleRetry} disabled={isRetrying}>
              {isRetrying ? "Retrying..." : "Retry Job"}
            </Button>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge className={getStatusColor(job.status)}>
                  {job.status}
                </Badge>
                <span className="text-muted-foreground">
                  Attempts: {job.attempts} / {job.maxAttempts}
                </span>
              </div>
              {job.lastError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded">
                  <p className="text-sm font-medium text-red-900 mb-1">
                    Last Error
                  </p>
                  <p className="text-sm text-red-700 font-mono">
                    {job.lastError}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Job Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-mono">{job.type}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Workspace ID</p>
                  <p className="font-mono text-sm">{job.workspaceId}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Created At</p>
                  <p className="text-sm">{formatDate(job.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Scheduled At</p>
                  <p className="text-sm">{formatDate(job.scheduledAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Updated At</p>
                  <p className="text-sm">{formatDate(job.updatedAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payload</CardTitle>
              <CardDescription>Job execution data</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="p-4 bg-muted rounded-lg overflow-auto max-h-96 text-sm">
                {JSON.stringify(job.payload, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
