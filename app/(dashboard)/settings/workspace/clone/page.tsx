"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function WorkspaceClonePage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [includeMembers, setIncludeMembers] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCloneWorkspace() {
    try {
      setCreating(true);
      setError(null);

      const token = await getToken();
      const workspaceId = localStorage.getItem("workspaceId");

      if (!workspaceId) {
        throw new Error("No workspace selected");
      }

      const response = await fetch(
        `/api/workspaces/${workspaceId}/clone`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            includeMembers,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create clone request");
      }

      const data = await response.json();

      // Redirect to clone status page
      router.push(`/settings/workspace/clone/${data.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to clone workspace");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Clone Workspace
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Create a complete copy of your workspace including agents, workflows,
          triggers, memory, evaluations, and settings.
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            What will be cloned?
          </h2>
          <ul className="space-y-2 text-gray-700 dark:text-gray-300">
            <li className="flex items-start">
              <span className="text-green-600 mr-2">✓</span>
              <span>
                <strong>Agents:</strong> All agent configurations, system
                prompts, and settings
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-green-600 mr-2">✓</span>
              <span>
                <strong>Workflows:</strong> Complete workflow definitions and
                steps
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-green-600 mr-2">✓</span>
              <span>
                <strong>Event Triggers:</strong> All event handlers and
                configurations
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-green-600 mr-2">✓</span>
              <span>
                <strong>Memory:</strong> All memory entries and embeddings
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-green-600 mr-2">✓</span>
              <span>
                <strong>Evaluation Suites:</strong> All eval suites and test
                cases
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-green-600 mr-2">✓</span>
              <span>
                <strong>API Keys:</strong> Cloned but set as inactive (for
                security)
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-green-600 mr-2">✓</span>
              <span>
                <strong>Workspace Limits:</strong> Plan tier and limit
                configurations
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-green-600 mr-2">✓</span>
              <span>
                <strong>Settings:</strong> All workspace preferences and
                configurations
              </span>
            </li>
          </ul>
        </div>

        <div className="border-t dark:border-gray-700 pt-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Clone Options
          </h2>

          <div className="space-y-4">
            <label className="flex items-start">
              <input
                type="checkbox"
                checked={includeMembers}
                onChange={(e) => setIncludeMembers(e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div className="ml-3">
                <span className="text-gray-900 dark:text-gray-100 font-medium">
                  Include workspace members
                </span>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Copy all workspace members and their roles to the new
                  workspace. If disabled, only you will be added to the cloned
                  workspace.
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="border-t dark:border-gray-700 pt-6">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
              Important Notes:
            </h3>
            <ul className="text-xs text-yellow-800 dark:text-yellow-300 space-y-1 list-disc list-inside">
              <li>Cloning is processed in the background and may take several minutes</li>
              <li>All object IDs will be regenerated (new unique IDs)</li>
              <li>Agent runs and historical data are NOT cloned</li>
              <li>API keys are cloned but set as inactive for security</li>
              <li>You will receive a notification when cloning is complete</li>
              <li>Cloning costs $0.25 per operation</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            disabled={creating}
          >
            Cancel
          </button>
          <button
            onClick={handleCloneWorkspace}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={creating}
          >
            {creating ? (
              <span className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                Creating Clone...
              </span>
            ) : (
              "Clone Workspace"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
