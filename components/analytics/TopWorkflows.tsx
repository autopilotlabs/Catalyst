"use client";

import { Card } from "@/components/ui/card";

interface Workflow {
  workflowId: string;
  workflowName: string;
  triggers: number;
}

interface TopWorkflowsProps {
  data: Workflow[] | null;
  loading: boolean;
}

export function TopWorkflows({ data, loading }: TopWorkflowsProps) {
  if (loading) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Top Workflows</h3>
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
        <h3 className="text-lg font-semibold mb-4">Top Workflows</h3>
        <p className="text-center text-gray-500 py-8">
          No workflow data available
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Top Workflows</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-gray-600 border-b">
              <th className="pb-2">Workflow</th>
              <th className="pb-2 text-right">Triggers</th>
            </tr>
          </thead>
          <tbody>
            {data.map((workflow) => (
              <tr key={workflow.workflowId} className="border-b last:border-0">
                <td className="py-3 font-medium">{workflow.workflowName}</td>
                <td className="py-3 text-right">{workflow.triggers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
