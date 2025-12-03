"use client";

import { Card } from "@/components/ui/card";

interface Agent {
  agentId: string;
  agentName: string;
  runs: number;
  tokens: number;
  cost: number;
}

interface TopAgentsProps {
  data: Agent[] | null;
  loading: boolean;
}

export function TopAgents({ data, loading }: TopAgentsProps) {
  if (loading) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Top Agents</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Top Agents</h3>
        <p className="text-center text-gray-500 py-8">No agent data available</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Top Agents</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-gray-600 border-b">
              <th className="pb-2">Agent</th>
              <th className="pb-2 text-right">Runs</th>
              <th className="pb-2 text-right">Tokens</th>
              <th className="pb-2 text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {data.map((agent) => (
              <tr key={agent.agentId} className="border-b last:border-0">
                <td className="py-3 font-medium">{agent.agentName}</td>
                <td className="py-3 text-right">{agent.runs}</td>
                <td className="py-3 text-right">
                  {agent.tokens.toLocaleString()}
                </td>
                <td className="py-3 text-right">${agent.cost.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
