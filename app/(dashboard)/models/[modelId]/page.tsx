"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface ModelVersion {
  id: string;
  version: number;
  label: string | null;
  createdAt: string;
  createdBy?: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

interface ModelDeployment {
  id: string;
  environment: string;
  alias: string | null;
  updatedAt: string;
  version: ModelVersion;
  createdBy?: {
    email: string;
  };
}

interface Model {
  id: string;
  name: string;
  provider: string;
  modelName: string;
  maxTokens: number;
  temperature?: number;
}

export default function ModelDetailPage() {
  const params = useParams();
  const modelId = params.modelId as string;

  const [model, setModel] = useState<Model | null>(null);
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [deployments, setDeployments] = useState<ModelDeployment[]>([]);
  const [loading, setLoading] = useState(true);

  // Create version dialog state
  const [createVersionOpen, setCreateVersionOpen] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [creatingVersion, setCreatingVersion] = useState(false);

  // Deploy dialog state
  const [deployOpen, setDeployOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [selectedEnvironment, setSelectedEnvironment] = useState<
    "dev" | "staging" | "prod"
  >("dev");
  const [deployAlias, setDeployAlias] = useState("");
  const [deploying, setDeploying] = useState(false);

  // Rollback dialog state
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [rollbackEnvironment, setRollbackEnvironment] = useState<
    "staging" | "prod"
  >("staging");
  const [rollbackVersionId, setRollbackVersionId] = useState("");
  const [rollingBack, setRollingBack] = useState(false);

  useEffect(() => {
    fetchData();
  }, [modelId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch model details - placeholder since we don't have a get endpoint yet
      // You may need to implement GET /api/models/[modelId] route
      setModel({
        id: modelId,
        name: "Model " + modelId,
        provider: "openai",
        modelName: "gpt-4o-mini",
        maxTokens: 16384,
        temperature: 0.7,
      });

      // Fetch versions
      const versionsRes = await fetch(`/api/models/versions/${modelId}`);
      const versionsData = await versionsRes.json();
      if (versionsData.success) {
        setVersions(versionsData.versions || []);
      }

      // Fetch deployments
      const deploymentsRes = await fetch(`/api/models/deployments/${modelId}`);
      const deploymentsData = await deploymentsRes.json();
      if (deploymentsData.success) {
        setDeployments(deploymentsData.deployments || []);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVersion = async () => {
    setCreatingVersion(true);
    try {
      const res = await fetch(`/api/models/versions/${modelId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: versionLabel || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setCreateVersionOpen(false);
        setVersionLabel("");
        fetchData();
      } else {
        alert(`Failed to create version: ${data.error}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setCreatingVersion(false);
    }
  };

  const handleDeploy = async () => {
    if (!selectedVersionId || !selectedEnvironment) {
      alert("Please select a version and environment");
      return;
    }

    setDeploying(true);
    try {
      const res = await fetch("/api/models/deployments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId,
          versionId: selectedVersionId,
          environment: selectedEnvironment,
          alias: deployAlias || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDeployOpen(false);
        setSelectedVersionId("");
        setDeployAlias("");
        fetchData();
      } else {
        alert(`Failed to deploy: ${data.error}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setDeploying(false);
    }
  };

  const handlePromote = async (deploymentId: string, targetEnv: "staging" | "prod") => {
    if (!confirm(`Promote this deployment to ${targetEnv}?`)) return;

    try {
      const res = await fetch("/api/models/deployments/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromDeploymentId: deploymentId,
          targetEnvironment: targetEnv,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(`Failed to promote: ${data.error}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleRollback = async () => {
    if (!rollbackVersionId || !rollbackEnvironment) {
      alert("Please select a version and environment");
      return;
    }

    if (!confirm(`Rollback ${rollbackEnvironment} to this version?`)) return;

    setRollingBack(true);
    try {
      const res = await fetch("/api/models/deployments/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId,
          environment: rollbackEnvironment,
          targetVersionId: rollbackVersionId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRollbackOpen(false);
        setRollbackVersionId("");
        fetchData();
      } else {
        alert(`Failed to rollback: ${data.error}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setRollingBack(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!model) {
    return <div className="p-8">Model not found</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Model Overview */}
      <Card className="p-6 mb-6">
        <h1 className="text-3xl font-bold mb-2">{model.name}</h1>
        <div className="flex gap-4 text-sm text-gray-500">
          <span>Provider: {model.provider}</span>
          <span>Model: {model.modelName}</span>
          <span>Max Tokens: {model.maxTokens}</span>
        </div>
      </Card>

      {/* Versions Section */}
      <Card className="p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">Versions</h2>
          <Dialog open={createVersionOpen} onOpenChange={setCreateVersionOpen}>
            <DialogTrigger asChild>
              <Button>Create Version</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Version</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="label">Version Label (optional)</Label>
                  <Input
                    id="label"
                    value={versionLabel}
                    onChange={(e) => setVersionLabel(e.target.value)}
                    placeholder="e.g., v1.2.0 or Release 1"
                  />
                </div>
                <Button
                  onClick={handleCreateVersion}
                  disabled={creatingVersion}
                  className="w-full"
                >
                  {creatingVersion ? "Creating..." : "Create Version"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {versions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No versions yet. Create your first version to enable deployments.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Version</th>
                  <th className="text-left py-2 px-4">Label</th>
                  <th className="text-left py-2 px-4">Created</th>
                  <th className="text-left py-2 px-4">Created By</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr key={version.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4">v{version.version}</td>
                    <td className="py-2 px-4">{version.label || "-"}</td>
                    <td className="py-2 px-4">
                      {new Date(version.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 px-4">
                      {version.createdBy?.email || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Deployments Section */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">Deployments</h2>
          <div className="flex gap-2">
            <Dialog open={rollbackOpen} onOpenChange={setRollbackOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Rollback</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Rollback Deployment</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Environment</Label>
                    <Select
                      value={rollbackEnvironment}
                      onValueChange={(val: any) => setRollbackEnvironment(val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staging">Staging</SelectItem>
                        <SelectItem value="prod">Production</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Target Version</Label>
                    <Select
                      value={rollbackVersionId}
                      onValueChange={setRollbackVersionId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select version" />
                      </SelectTrigger>
                      <SelectContent>
                        {versions.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            v{v.version} - {v.label || "Unlabeled"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleRollback}
                    disabled={rollingBack}
                    className="w-full"
                  >
                    {rollingBack ? "Rolling back..." : "Rollback"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={deployOpen} onOpenChange={setDeployOpen}>
              <DialogTrigger asChild>
                <Button>Deploy Version</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Deploy Version</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Version</Label>
                    <Select
                      value={selectedVersionId}
                      onValueChange={setSelectedVersionId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select version" />
                      </SelectTrigger>
                      <SelectContent>
                        {versions.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            v{v.version} - {v.label || "Unlabeled"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Environment</Label>
                    <Select
                      value={selectedEnvironment}
                      onValueChange={(val: any) => setSelectedEnvironment(val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dev">Development</SelectItem>
                        <SelectItem value="staging">Staging</SelectItem>
                        <SelectItem value="prod">Production</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="alias">Alias (optional)</Label>
                    <Input
                      id="alias"
                      value={deployAlias}
                      onChange={(e) => setDeployAlias(e.target.value)}
                      placeholder="e.g., stable, beta"
                    />
                  </div>
                  <Button
                    onClick={handleDeploy}
                    disabled={deploying}
                    className="w-full"
                  >
                    {deploying ? "Deploying..." : "Deploy"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {deployments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No deployments yet. Deploy a version to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Environment</th>
                  <th className="text-left py-2 px-4">Version</th>
                  <th className="text-left py-2 px-4">Alias</th>
                  <th className="text-left py-2 px-4">Updated</th>
                  <th className="text-left py-2 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deployments.map((deployment) => (
                  <tr key={deployment.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4">
                      <Badge
                        variant={
                          deployment.environment === "prod"
                            ? "default"
                            : deployment.environment === "staging"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {deployment.environment}
                      </Badge>
                    </td>
                    <td className="py-2 px-4">
                      v{deployment.version.version} -{" "}
                      {deployment.version.label || "Unlabeled"}
                    </td>
                    <td className="py-2 px-4">{deployment.alias || "-"}</td>
                    <td className="py-2 px-4">
                      {new Date(deployment.updatedAt).toLocaleString()}
                    </td>
                    <td className="py-2 px-4">
                      <div className="flex gap-2">
                        {deployment.environment === "dev" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePromote(deployment.id, "staging")}
                          >
                            → Staging
                          </Button>
                        )}
                        {deployment.environment === "staging" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePromote(deployment.id, "prod")}
                          >
                            → Prod
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
