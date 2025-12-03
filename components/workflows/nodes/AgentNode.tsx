"use client";

import { Handle, Position } from "@xyflow/react";
import { Bot } from "lucide-react";

interface AgentNodeProps {
  data: {
    label?: string;
    agentId?: string;
  };
  isConnectable?: boolean;
}

export function AgentNode({ data, isConnectable }: AgentNodeProps) {
  return (
    <div className="px-4 py-3 shadow-md rounded-lg bg-white border-2 border-blue-500 min-w-[150px]">
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="!bg-blue-500 !w-3 !h-3"
      />
      <div className="flex items-center gap-2">
        <Bot className="w-4 h-4 text-blue-600" />
        <div className="text-sm font-semibold text-gray-800">
          {data.label || "Agent"}
        </div>
      </div>
      {data.agentId && (
        <div className="text-xs text-gray-500 mt-1 truncate">
          {data.agentId}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="!bg-blue-500 !w-3 !h-3"
      />
    </div>
  );
}
