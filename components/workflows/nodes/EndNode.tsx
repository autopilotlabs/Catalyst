"use client";

import { Handle, Position } from "@xyflow/react";
import { Square } from "lucide-react";

interface EndNodeProps {
  data: {
    label?: string;
  };
  isConnectable?: boolean;
}

export function EndNode({ data, isConnectable }: EndNodeProps) {
  return (
    <div className="px-4 py-3 shadow-md rounded-lg bg-white border-2 border-red-500 min-w-[150px]">
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="!bg-red-500 !w-3 !h-3"
      />
      <div className="flex items-center gap-2">
        <Square className="w-4 h-4 text-red-600" />
        <div className="text-sm font-semibold text-gray-800">
          {data.label || "End"}
        </div>
      </div>
    </div>
  );
}
