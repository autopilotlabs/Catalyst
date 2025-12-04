"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

interface WorkspaceLimits {
  id: string;
  planTier: string;
  maxAgents: number;
  maxWorkflows: number;
  maxTriggers: number;
  maxMemoryMB: number;
  maxApiKeys: number;
  maxMonthlyTokens: number;
  softTokenThreshold: number;
  hardTokenThreshold: number;
}

interface WorkspaceUsage {
  agents: number;
  workflows: number;
  triggers: number;
  memoryMB: number;
  apiKeys: number;
  monthlyTokens: number;
}

export default function LimitsPage() {
  const { getToken } = useAuth();
  const [limits, setLimits] = useState<WorkspaceLimits | null>(null);
  const [usage, setUsage] = useState<WorkspaceUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedLimits, setEditedLimits] = useState<Partial<WorkspaceLimits>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchLimits();
  }, []);

  async function fetchLimits() {
    try {
      setLoading(true);
      const token = await getToken();

      const response = await fetch("/api/limits", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch limits");
      }

      const data = await response.json();
      setLimits(data.limits);
      setUsage(data.usage);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load limits");
    } finally {
      setLoading(false);
    }
  }

  async function saveLimits() {
    try {
      setSaving(true);
      const token = await getToken();

      const response = await fetch("/api/limits/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editedLimits),
      });

      if (!response.ok) {
        throw new Error("Failed to update limits");
      }

      const updatedLimits = await response.json();
      setLimits(updatedLimits);
      setEditMode(false);
      setEditedLimits({});
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to save limits");
    } finally {
      setSaving(false);
    }
  }

  function getUsagePercent(current: number, max: number): number {
    if (max === 0) return 0;
    return Math.min((current / max) * 100, 100);
  }

  function getProgressColor(percent: number, softThreshold: number): string {
    if (percent >= 100) return "bg-red-500";
    if (percent >= softThreshold * 100) return "bg-yellow-500";
    return "bg-green-500";
  }

  function renderLimitRow(
    label: string,
    current: number,
    max: number,
    field: keyof WorkspaceLimits,
    softThreshold: number = 0.8
  ) {
    const percent = getUsagePercent(current, max);
    const color = getProgressColor(percent, softThreshold);

    return (
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            {label}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {current.toLocaleString()} / {max.toLocaleString()}
            </span>
            {editMode && (
              <input
                type="number"
                value={editedLimits[field] ?? max}
                onChange={(e) =>
                  setEditedLimits({
                    ...editedLimits,
                    [field]: parseInt(e.target.value),
                  })
                }
                className="w-24 px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-600"
              />
            )}
          </div>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div
            className={`${color} h-2.5 rounded-full transition-all`}
            style={{ width: `${percent}%` }}
          ></div>
        </div>
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {percent.toFixed(1)}% used
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
          <button
            onClick={fetchLimits}
            className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!limits || !usage) {
    return (
      <div className="p-8">
        <p className="text-gray-600 dark:text-gray-400">No limits data available</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Workspace Limits
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Current plan: <span className="font-semibold capitalize">{limits.planTier}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {editMode ? (
            <>
              <button
                onClick={() => {
                  setEditMode(false);
                  setEditedLimits({});
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={saveLimits}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Edit Limits
            </button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {renderLimitRow(
          "Agent Configurations",
          usage.agents,
          limits.maxAgents,
          "maxAgents"
        )}
        {renderLimitRow(
          "Workflows",
          usage.workflows,
          limits.maxWorkflows,
          "maxWorkflows"
        )}
        {renderLimitRow(
          "Event Triggers",
          usage.triggers,
          limits.maxTriggers,
          "maxTriggers"
        )}
        {renderLimitRow(
          "Memory (MB)",
          usage.memoryMB,
          limits.maxMemoryMB,
          "maxMemoryMB"
        )}
        {renderLimitRow(
          "API Keys",
          usage.apiKeys,
          limits.maxApiKeys,
          "maxApiKeys"
        )}
        {renderLimitRow(
          "Monthly Tokens",
          usage.monthlyTokens,
          limits.maxMonthlyTokens,
          "maxMonthlyTokens",
          limits.softTokenThreshold
        )}
      </div>

      {editMode && (
        <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Threshold Settings
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Soft Limit Threshold (Warning)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={editedLimits.softTokenThreshold ?? limits.softTokenThreshold}
                onChange={(e) =>
                  setEditedLimits({
                    ...editedLimits,
                    softTokenThreshold: parseFloat(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Trigger warnings at this usage ratio (0.0 - 1.0)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Hard Limit Threshold (Block)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={editedLimits.hardTokenThreshold ?? limits.hardTokenThreshold}
                onChange={(e) =>
                  setEditedLimits({
                    ...editedLimits,
                    hardTokenThreshold: parseFloat(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Block actions at this usage ratio (0.0 - 1.0)
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          About Workspace Limits
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
          <li>
            <strong>Soft Limit (Yellow):</strong> Warning notifications are sent when usage
            reaches this threshold
          </li>
          <li>
            <strong>Hard Limit (Red):</strong> Actions are blocked when usage reaches this
            threshold
          </li>
          <li>Limits are reset monthly for token-based resources</li>
          <li>Contact support to upgrade your plan for higher limits</li>
        </ul>
      </div>
    </div>
  );
}
