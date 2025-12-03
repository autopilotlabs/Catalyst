"use client";

import { Card } from "@/components/ui/card";
import { Activity, Workflow, Cpu, DollarSign } from "lucide-react";

interface UsageSummaryProps {
  data: {
    totalRuns: number;
    totalWorkflows: number;
    totalTokens: number;
    totalCost: number;
  } | null;
  loading: boolean;
}

export function UsageSummary({ data, loading }: UsageSummaryProps) {
  const stats = [
    {
      label: "Total Runs",
      value: data?.totalRuns || 0,
      icon: Activity,
      color: "text-blue-600",
    },
    {
      label: "Workflows Triggered",
      value: data?.totalWorkflows || 0,
      icon: Workflow,
      color: "text-green-600",
    },
    {
      label: "Total Tokens",
      value: (data?.totalTokens || 0).toLocaleString(),
      icon: Cpu,
      color: "text-purple-600",
    },
    {
      label: "Estimated Cost",
      value: `$${(data?.totalCost || 0).toFixed(4)}`,
      icon: DollarSign,
      color: "text-amber-600",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{stat.label}</p>
              {loading ? (
                <div className="h-8 w-24 bg-gray-200 rounded animate-pulse mt-2" />
              ) : (
                <p className="text-2xl font-bold mt-2">{stat.value}</p>
              )}
            </div>
            <stat.icon className={`w-8 h-8 ${stat.color}`} />
          </div>
        </Card>
      ))}
    </div>
  );
}
