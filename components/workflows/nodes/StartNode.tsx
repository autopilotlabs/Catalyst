"use client";

import { Handle, Position } from "@xyflow/react";
import { Play } from "lucide-react";

interface StartNodeProps {
  data: {
    label?: string;
  };
  isConnectable?: boolean;
}

export function StartNode({ data, isConnectable }: StartNodeProps) {
  return (
    <div className="px-4 py-3 shadow-md rounded-lg bg-white border-2 border-green-500 min-w-[150px]">
      <div className="flex items-center gap-2">
        <Play className="w-4 h-4 text-green-600" />
        <div className="text-sm font-semibold text-gray-800">
          {data.label || "Start"}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="!bg-green-500 !w-3 !h-3"
      />
    </div>
  );
}
