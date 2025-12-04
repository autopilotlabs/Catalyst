"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface CloneRequest {
  id: string;
  sourceWorkspaceId: string;
  targetWorkspaceId: string | null;
  status: string;
  includeMembers: boolean;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function CloneStatusPage() {
  const { getToken } = useAuth();
  const params = useParams();
  const router = useRouter();
  const cloneId = params.cloneId as string;
  
  const [clone, setClone] = useState<CloneRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCloneStatus();
    
    // Auto-refresh every 5 seconds if status is pending or running
    const interval = setInterval(() => {
      if (clone?.status === "pending" || clone?.status === "running") {
        fetchCloneStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [cloneId, clone?.status]);

  async function fetchCloneStatus() {
    try {
      setLoading(true);
      const token = await getToken();

      const response = await fetch(`/api/workspace-clones/${cloneId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch clone status");
      }

      const data = await response.json();
      setClone(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load clone status");
    } finally {
      setLoading(false);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "success":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "running":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "error":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "success":
        return "✓";
      case "running":
        return (
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        );
      case "pending":
        return "⏳";
      case "error":
        return "✗";
      default:
        return "•";
    }
  }

  function getStatusMessage(status: string) {
    switch (status) {
      case "success":
        return "Your workspace has been successfully cloned!";
      case "running":
        return "Cloning in progress... This may take several minutes.";
      case "pending":
        return "Your clone request is queued and will be processed shortly.";
      case "error":
        return "An error occurred while cloning your workspace.";
      default:
        return "Unknown status";
    }
  }

  if (loading && !clone) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error && !clone) {
    return (
      <div className="p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      </div>
    );
  }

  if (!clone) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">
            Clone request not found
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Workspace Clone Status
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Track the progress of your workspace duplication
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-3 rounded-full ${getStatusColor(clone.status)}`}>
              {getStatusIcon(clone.status)}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {clone.status.charAt(0).toUpperCase() + clone.status.slice(1)}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {getStatusMessage(clone.status)}
              </p>
            </div>
          </div>
          <span
            className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(
              clone.status
            )}`}
          >
            {clone.status.toUpperCase()}
          </span>
        </div>

        {/* Clone Details */}
        <div className="border-t dark:border-gray-700 pt-6 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Clone ID
            </h3>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 font-mono">
              {clone.id}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Created At
            </h3>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {new Date(clone.createdAt).toLocaleString()}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Last Updated
            </h3>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {new Date(clone.updatedAt).toLocaleString()}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Include Members
            </h3>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {clone.includeMembers ? "Yes" : "No"}
            </p>
          </div>

          {clone.targetWorkspaceId && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                New Workspace ID
              </h3>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 font-mono">
                {clone.targetWorkspaceId}
              </p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {clone.error && (
          <div className="border-t dark:border-gray-700 pt-6">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-red-900 dark:text-red-200 mb-2">
                Error Details:
              </h3>
              <p className="text-sm text-red-800 dark:text-red-300">
                {clone.error}
              </p>
            </div>
          </div>
        )}

        {/* Success Actions */}
        {clone.status === "success" && clone.targetWorkspaceId && (
          <div className="border-t dark:border-gray-700 pt-6">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-green-900 dark:text-green-200 mb-2">
                Clone Complete!
              </h3>
              <p className="text-sm text-green-800 dark:text-green-300 mb-3">
                Your workspace has been successfully cloned. You can now switch
                to the new workspace or continue viewing this status.
              </p>
              <button
                onClick={() => {
                  localStorage.setItem("workspaceId", clone.targetWorkspaceId!);
                  router.push("/");
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                Switch to New Workspace
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t dark:border-gray-700">
          <button
            onClick={() => router.push("/settings/workspace/clone")}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            ← Back to Clone
          </button>
          <button
            onClick={fetchCloneStatus}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh Status"}
          </button>
        </div>
      </div>
    </div>
  );
}
