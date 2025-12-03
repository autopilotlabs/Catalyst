"use client";

import { Card } from "@/components/ui/card";

interface TimeSeriesDataPoint {
  date: string;
  runs: number;
  workflows: number;
  tokens: number;
  cost: number;
}

interface TimeSeriesChartProps {
  data: TimeSeriesDataPoint[] | null;
  loading: boolean;
  metric: "runs" | "tokens" | "cost";
}

export function TimeSeriesChart({
  data,
  loading,
  metric,
}: TimeSeriesChartProps) {
  if (loading) {
    return (
      <Card className="p-6">
        <div className="h-64 bg-gray-200 rounded animate-pulse" />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-gray-500">No data available</p>
      </Card>
    );
  }

  // Find max value for scaling
  const maxValue = Math.max(...data.map((d) => d[metric]));
  const height = 200;

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 capitalize">
        {metric === "runs"
          ? "Agent Runs"
          : metric === "tokens"
          ? "Tokens Used"
          : "Cost"}
        {" over Time"}
      </h3>
      <div className="relative">
        <svg width="100%" height={height} className="overflow-visible">
          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={i}
              x1="0"
              y1={(height * i) / 4}
              x2="100%"
              y2={(height * i) / 4}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          ))}

          {/* Line chart */}
          <polyline
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            points={data
              .map((point, index) => {
                const x = (index / (data.length - 1 || 1)) * 100;
                const y = height - (point[metric] / (maxValue || 1)) * height;
                return `${x}%,${y}`;
              })
              .join(" ")}
          />

          {/* Data points */}
          {data.map((point, index) => {
            const x = (index / (data.length - 1 || 1)) * 100;
            const y = height - (point[metric] / (maxValue || 1)) * height;
            return (
              <circle
                key={index}
                cx={`${x}%`}
                cy={y}
                r="4"
                fill="#3b82f6"
                className="cursor-pointer hover:r-6 transition-all"
              >
                <title>
                  {point.date}: {point[metric]}
                </title>
              </circle>
            );
          })}
        </svg>

        {/* X-axis labels */}
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>{data[0]?.date}</span>
          <span>{data[Math.floor(data.length / 2)]?.date}</span>
          <span>{data[data.length - 1]?.date}</span>
        </div>
      </div>
    </Card>
  );
}
