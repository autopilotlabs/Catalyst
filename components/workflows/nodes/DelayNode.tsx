"use client";

import { Handle, Position } from "@xyflow/react";
import { Clock } from "lucide-react";

interface DelayNodeProps {
  data: {
    label?: string;
    ms?: number;
  };
  isConnectable?: boolean;
}

export function DelayNode({ data, isConnectable }: DelayNodeProps) {
  const formatDelay = (ms?: number) => {
    if (!ms) return "0ms";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="px-4 py-3 shadow-md rounded-lg bg-white border-2 border-purple-500 min-w-[150px]">
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="!bg-purple-500 !w-3 !h-3"
      />
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-purple-600" />
        <div className="text-sm font-semibold text-gray-800">
          {data.label || "Delay"}
        </div>
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {formatDelay(data.ms)}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="!bg-purple-500 !w-3 !h-3"
      />
    </div>
  );
}
