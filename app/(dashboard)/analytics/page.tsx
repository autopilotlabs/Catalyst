"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { UsageSummary } from "@/components/analytics/UsageSummary";
import { TimeSeriesChart } from "@/components/analytics/TimeSeriesChart";
import { TopAgents } from "@/components/analytics/TopAgents";
import { TopWorkflows } from "@/components/analytics/TopWorkflows";
import { RecentActivity } from "@/components/analytics/RecentActivity";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function AnalyticsContent() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspaceId") || "";

  const [timeRange, setTimeRange] = useState<"7" | "30" | "90">("30");
  const [metric, setMetric] = useState<"runs" | "tokens" | "cost">("runs");
  
  const [summary, setSummary] = useState<any>(null);
  const [timeseries, setTimeseries] = useState<any>(null);
  const [topAgents, setTopAgents] = useState<any>(null);
  const [topWorkflows, setTopWorkflows] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    loadAnalytics();
  }, [workspaceId, timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const headers = {
        "x-workspace-id": workspaceId,
      };

      const [summaryRes, timeseriesRes, agentsRes, workflowsRes, activityRes] =
        await Promise.all([
          fetch("/api/analytics/summary", { headers }),
          fetch(`/api/analytics/timeseries?days=${timeRange}`, { headers }),
          fetch("/api/analytics/top-agents", { headers }),
          fetch("/api/analytics/top-workflows", { headers }),
          fetch("/api/analytics/activity", { headers }),
        ]);

      const summaryData = await summaryRes.json();
      const timeseriesData = await timeseriesRes.json();
      const agentsData = await agentsRes.json();
      const workflowsData = await workflowsRes.json();
      const activityData = await activityRes.json();

      setSummary(summaryData.data);
      setTimeseries(timeseriesData.data);
      setTopAgents(agentsData.data);
      setTopWorkflows(workflowsData.data);
      setRecentActivity(activityData.data);
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-gray-600">
            Workspace usage insights and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select
            value={timeRange}
            onValueChange={(value: any) => setTimeRange(value)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <UsageSummary data={summary} loading={loading} />

      {/* Time Series Chart */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">Trends</h2>
          <div className="flex gap-2">
            <Button
              variant={metric === "runs" ? "default" : "outline"}
              size="sm"
              onClick={() => setMetric("runs")}
            >
              Runs
            </Button>
            <Button
              variant={metric === "tokens" ? "default" : "outline"}
              size="sm"
              onClick={() => setMetric("tokens")}
            >
              Tokens
            </Button>
            <Button
              variant={metric === "cost" ? "default" : "outline"}
              size="sm"
              onClick={() => setMetric("cost")}
            >
              Cost
            </Button>
          </div>
        </div>
        <TimeSeriesChart data={timeseries} loading={loading} metric={metric} />
      </div>

      {/* Top Agents and Workflows */}
      <div className="grid gap-6 md:grid-cols-2">
        <TopAgents data={topAgents} loading={loading} />
        <TopWorkflows data={topWorkflows} loading={loading} />
      </div>

      {/* Recent Activity */}
      <RecentActivity data={recentActivity} loading={loading} />
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="container mx-auto p-6">Loading...</div>}>
      <AnalyticsContent />
    </Suspense>
  );
}
