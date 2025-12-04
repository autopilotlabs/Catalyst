"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface Agent {
  id: string;
  name: string;
  description?: string;
  model: string;
  createdAt: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      if (data.success) {
        setAgents(data.agents || []);
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading agents...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Agents</h1>
          <p className="text-gray-600 mt-1">
            Manage your AI agents and their deployments
          </p>
        </div>
        <Link href="/agents/new">
          <Button>Create Agent</Button>
        </Link>
      </div>

      {agents.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-500 mb-4">No agents found</p>
          <Link href="/agents/new">
            <Button>Create Your First Agent</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4">
          {agents.map((agent) => (
            <Card key={agent.id} className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">{agent.name}</h3>
                  {agent.description && (
                    <p className="text-gray-600 mb-2">{agent.description}</p>
                  )}
                  <div className="flex gap-4 text-sm text-gray-500">
                    <span>Model: {agent.model}</span>
                    <span>
                      Created: {new Date(agent.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <Link href={`/agents/${agent.id}`}>
                  <Button variant="outline">Manage</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
