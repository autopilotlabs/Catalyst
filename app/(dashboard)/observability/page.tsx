"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

interface ObservabilityEvent {
  id: string;
  timestamp: string;
  category: string;
  eventType: string;
  entityId?: string;
  entityType?: string;
  durationMs?: number;
  success?: boolean;
  metadata?: any;
}

interface Metric {
  periodStart: string;
  periodEnd: string;
  value: number;
  metadata?: any;
}

export default function ObservabilityPage() {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<"events" | "metrics" | "traces">("events");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Events state
  const [events, setEvents] = useState<ObservabilityEvent[]>([]);
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState(100);

  // Metrics state
  const [metricsCategory, setMetricsCategory] = useState("agent");
  const [metricsRange, setMetricsRange] = useState<"1d" | "7d" | "30d">("7d");
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [metricsTotal, setMetricsTotal] = useState(0);

  // Traces state
  const [traceEntityType, setTraceEntityType] = useState("agent");
  const [traceEntityId, setTraceEntityId] = useState("");
  const [trace, setTrace] = useState<any>(null);

  useEffect(() => {
    if (activeTab === "events") {
      fetchEvents();
    }
  }, [activeTab]);

  async function fetchEvents() {
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();

      const params = new URLSearchParams();
      if (category) params.append("category", category);
      if (limit) params.append("limit", limit.toString());

      const response = await fetch(
        `/api/observability/events${params.toString() ? `?${params.toString()}` : ""}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }

      const data = await response.json();
      setEvents(data.events || []);
    } catch (err: any) {
      setError(err.message || "Failed to load events");
    } finally {
      setLoading(false);
    }
  }

  async function fetchMetrics() {
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();

      const response = await fetch(
        `/api/observability/metrics?category=${metricsCategory}&range=${metricsRange}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch metrics");
      }

      const data = await response.json();
      setMetrics(data.metrics || []);
      setMetricsTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message || "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }

  async function fetchTrace() {
    if (!traceEntityId || !traceEntityType) {
      setError("Please provide both entity type and entity ID");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = await getToken();

      const response = await fetch(
        `/api/observability/trace/${traceEntityType}/${traceEntityId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch trace");
      }

      const data = await response.json();
      setTrace(data);
    } catch (err: any) {
      setError(err.message || "Failed to load trace");
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(success?: boolean) {
    if (success === undefined || success === null) return null;
    return success ? (
      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        Success
      </span>
    ) : (
      <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
        Failed
      </span>
    );
  }

  function getCategoryColor(category: string) {
    const colors: Record<string, string> = {
      model: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      agent: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      workflow: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      trigger: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      memory: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
      job: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      external: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
      billing: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
      eval: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    return colors[category] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Observability
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Monitor events, metrics, and traces across your workspace
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("events")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "events"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          }`}
        >
          Events
        </button>
        <button
          onClick={() => setActiveTab("metrics")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "metrics"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          }`}
        >
          Metrics
        </button>
        <button
          onClick={() => setActiveTab("traces")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "traces"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          }`}
        >
          Traces
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Events Tab */}
      {activeTab === "events" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="">All Categories</option>
                  <option value="model">Model</option>
                  <option value="agent">Agent</option>
                  <option value="workflow">Workflow</option>
                  <option value="trigger">Trigger</option>
                  <option value="memory">Memory</option>
                  <option value="job">Job</option>
                  <option value="external">External</option>
                  <option value="billing">Billing</option>
                  <option value="eval">Eval</option>
                </select>
              </div>
              <div className="w-32">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Limit
                </label>
                <input
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  min="10"
                  max="1000"
                />
              </div>
              <button
                onClick={fetchEvents}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Loading..." : "Fetch Events"}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Event Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {events.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                        No events found. Try adjusting your filters.
                      </td>
                    </tr>
                  ) : (
                    events.map((event) => (
                      <tr key={event.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {new Date(event.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(event.category)}`}>
                            {event.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {event.eventType}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {event.durationMs ? `${event.durationMs}ms` : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(event.success)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Tab */}
      {activeTab === "metrics" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  value={metricsCategory}
                  onChange={(e) => setMetricsCategory(e.target.value)}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="model">Model</option>
                  <option value="agent">Agent</option>
                  <option value="workflow">Workflow</option>
                  <option value="memory">Memory</option>
                  <option value="job">Job</option>
                  <option value="billing">Billing</option>
                </select>
              </div>
              <div className="w-40">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Range
                </label>
                <select
                  value={metricsRange}
                  onChange={(e) => setMetricsRange(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="1d">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
              </div>
              <button
                onClick={fetchMetrics}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Loading..." : "Fetch Metrics"}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Total: {metricsTotal.toLocaleString()}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {metricsCategory} events in {metricsRange}
              </p>
            </div>

            <div className="space-y-2">
              {metrics.length === 0 ? (
                <p className="text-center py-12 text-gray-500 dark:text-gray-400">
                  No metrics found. Try selecting a different category or range.
                </p>
              ) : (
                metrics.map((metric, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {new Date(metric.periodStart).toLocaleString()} - {new Date(metric.periodEnd).toLocaleString()}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {metric.value.toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Traces Tab */}
      {activeTab === "traces" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex gap-4 items-end">
              <div className="w-40">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Entity Type
                </label>
                <select
                  value={traceEntityType}
                  onChange={(e) => setTraceEntityType(e.target.value)}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="agent">Agent</option>
                  <option value="workflow">Workflow</option>
                  <option value="trigger">Trigger</option>
                  <option value="job">Job</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Entity ID
                </label>
                <input
                  type="text"
                  value={traceEntityId}
                  onChange={(e) => setTraceEntityId(e.target.value)}
                  placeholder="Enter entity ID (e.g., agent run ID)"
                  className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <button
                onClick={fetchTrace}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Loading..." : "Fetch Trace"}
              </button>
            </div>
          </div>

          {trace && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Trace: {trace.entityType}/{trace.entityId}
              </h3>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Timeline ({trace.events.length} events)
                  </h4>
                  <div className="space-y-2">
                    {trace.timeline.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded"
                      >
                        <span className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(item.category)}`}>
                          {item.category}
                        </span>
                        <span className="text-sm text-gray-900 dark:text-gray-100 flex-1">
                          {item.eventType}
                        </span>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {item.durationMs ? `${item.durationMs}ms` : ""}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
