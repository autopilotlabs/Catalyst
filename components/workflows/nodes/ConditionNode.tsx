"use client";

import { Handle, Position } from "@xyflow/react";
import { GitBranch } from "lucide-react";

interface ConditionNodeProps {
  data: {
    label?: string;
    condition?: string;
  };
  isConnectable?: boolean;
}

export function ConditionNode({ data, isConnectable }: ConditionNodeProps) {
  return (
    <div className="px-4 py-3 shadow-md rounded-lg bg-white border-2 border-amber-500 min-w-[150px]">
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="!bg-amber-500 !w-3 !h-3"
      />
      <div className="flex items-center gap-2">
        <GitBranch className="w-4 h-4 text-amber-600" />
        <div className="text-sm font-semibold text-gray-800">
          {data.label || "Condition"}
        </div>
      </div>
      {data.condition && (
        <div className="text-xs text-gray-500 mt-1 truncate max-w-[200px]">
          {data.condition}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="!bg-amber-500 !w-3 !h-3"
      />
    </div>
  );
}
