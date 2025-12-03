"use client";

import { useCallback, useState, useEffect } from "react";
import {
  ReactFlow,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Background,
  Controls,
  MiniMap,
  Panel,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { StartNode } from "./nodes/StartNode";
import { AgentNode } from "./nodes/AgentNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { DelayNode } from "./nodes/DelayNode";
import { EndNode } from "./nodes/EndNode";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Plus, Save } from "lucide-react";

const nodeTypes = {
  start: StartNode,
  agent: AgentNode,
  condition: ConditionNode,
  delay: DelayNode,
  end: EndNode,
};

interface WorkflowEditorProps {
  workflowId: string;
  workspaceId: string;
}

export function WorkflowEditor({ workflowId, workspaceId }: WorkflowEditorProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);

  // Load workflow data
  useEffect(() => {
    loadWorkflow();
  }, [workflowId]);

  const loadWorkflow = async () => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}`, {
        headers: {
          "x-workspace-id": workspaceId,
        },
      });

      if (!response.ok) throw new Error("Failed to load workflow");

      const data = await response.json();

      // Convert steps to nodes
      const loadedNodes = data.steps.map((step: any) => ({
        id: step.id,
        type: step.type,
        position: step.position,
        data: {
          label: step.type.charAt(0).toUpperCase() + step.type.slice(1),
          ...step.config,
        },
      }));

      setNodes(loadedNodes);
    } catch (error) {
      console.error("Error loading workflow:", error);
    }
  };

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      // Auto-save on position change
      const positionChanges = changes.filter(
        (change) => change.type === "position" && "position" in change
      );
      if (positionChanges.length > 0) {
        saveNodes();
      }
    },
    []
  );

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge(connection, eds));
  }, []);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const addNode = async (type: string) => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}/steps`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspaceId,
        },
        body: JSON.stringify({
          type,
          config: {},
          position: { x: 250, y: nodes.length * 100 + 50 },
          order: nodes.length,
        }),
      });

      if (!response.ok) throw new Error("Failed to add node");

      const step = await response.json();

      const newNode: Node = {
        id: step.id,
        type: step.type,
        position: step.position,
        data: {
          label: type.charAt(0).toUpperCase() + type.slice(1),
        },
      };

      setNodes((nds) => [...nds, newNode]);
    } catch (error) {
      console.error("Error adding node:", error);
    }
  };

  const saveNodes = async () => {
    if (saving) return;

    setSaving(true);
    try {
      // Save all node positions
      await Promise.all(
        nodes.map((node) =>
          fetch(`/api/workflows/${workflowId}/steps/${node.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "x-workspace-id": workspaceId,
            },
            body: JSON.stringify({
              position: node.position,
            }),
          })
        )
      );
    } catch (error) {
      console.error("Error saving nodes:", error);
    } finally {
      setSaving(false);
    }
  };

  const updateNodeConfig = async (nodeId: string, config: any) => {
    try {
      const response = await fetch(
        `/api/workflows/${workflowId}/steps/${nodeId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-workspace-id": workspaceId,
          },
          body: JSON.stringify({ config }),
        }
      );

      if (!response.ok) throw new Error("Failed to update node");

      // Update local state
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...config } }
            : node
        )
      );
    } catch (error) {
      console.error("Error updating node:", error);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Main Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
          <Panel position="top-right" className="space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => addNode("start")}
            >
              <Plus className="w-4 h-4 mr-1" />
              Start
            </Button>
            <Button size="sm" variant="outline" onClick={() => addNode("agent")}>
              <Plus className="w-4 h-4 mr-1" />
              Agent
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => addNode("condition")}
            >
              <Plus className="w-4 h-4 mr-1" />
              Condition
            </Button>
            <Button size="sm" variant="outline" onClick={() => addNode("delay")}>
              <Plus className="w-4 h-4 mr-1" />
              Delay
            </Button>
            <Button size="sm" variant="outline" onClick={() => addNode("end")}>
              <Plus className="w-4 h-4 mr-1" />
              End
            </Button>
          </Panel>
        </ReactFlow>
      </div>

      {/* Right Panel - Node Config */}
      {selectedNode && (
        <div className="w-80 border-l bg-white p-4 overflow-y-auto">
          <h3 className="font-semibold text-lg mb-4">
            {String(selectedNode.data.label || "Node")} Settings
          </h3>

          {selectedNode.type === "agent" && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="agentId">Agent ID</Label>
                <Input
                  id="agentId"
                  value={String(selectedNode.data.agentId || "")}
                  onChange={(e) =>
                    updateNodeConfig(selectedNode.id, {
                      agentId: e.target.value,
                    })
                  }
                  placeholder="Enter agent ID"
                />
              </div>
              <div>
                <Label htmlFor="inputTemplate">Input Template (JSON)</Label>
                <textarea
                  id="inputTemplate"
                  className="w-full border rounded p-2 text-sm font-mono"
                  rows={6}
                  value={
                    selectedNode.data.inputTemplate
                      ? JSON.stringify(selectedNode.data.inputTemplate, null, 2)
                      : "{}"
                  }
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      updateNodeConfig(selectedNode.id, {
                        inputTemplate: parsed,
                      });
                    } catch (err) {
                      // Invalid JSON, don't update
                    }
                  }}
                />
              </div>
            </div>
          )}

          {selectedNode.type === "condition" && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="condition">Condition</Label>
                <Input
                  id="condition"
                  value={String(selectedNode.data.condition || "")}
                  onChange={(e) =>
                    updateNodeConfig(selectedNode.id, {
                      condition: e.target.value,
                    })
                  }
                  placeholder="e.g., status === 'active'"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use simple JavaScript expressions
                </p>
              </div>
            </div>
          )}

          {selectedNode.type === "delay" && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="ms">Delay (milliseconds)</Label>
                <Input
                  id="ms"
                  type="number"
                  value={Number(selectedNode.data.ms || 0)}
                  onChange={(e) =>
                    updateNodeConfig(selectedNode.id, {
                      ms: parseInt(e.target.value) || 0,
                    })
                  }
                  max={300000}
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1">Max: 5 minutes</p>
              </div>
            </div>
          )}

          {(selectedNode.type === "start" || selectedNode.type === "end") && (
            <div className="text-sm text-gray-500">
              This node has no configuration options.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
