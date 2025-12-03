"use client";

import { useEffect, useState } from "react";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AuditLog {
  id: string;
  workspaceId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: any;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

interface AuditResponse {
  data: AuditLog[];
  nextCursor: string | null;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [entityType, setEntityType] = useState<string>("");
  const [action, setAction] = useState<string>("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async (cursor?: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (entityType) params.append("entityType", entityType);
      if (action) params.append("action", action);
      params.append("limit", "50");
      if (cursor) params.append("cursor", cursor);

      const response = await fetch(`/api/audit?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch audit logs");
      }

      const data: AuditResponse = await response.json();
      
      if (cursor) {
        // Append for pagination
        setLogs((prev) => [...prev, ...data.data]);
      } else {
        // Replace for filtering
        setLogs(data.data);
      }
      
      setNextCursor(data.nextCursor);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleFilter = () => {
    fetchLogs();
  };

  const handleReset = () => {
    setEntityType("");
    setAction("");
    fetchLogs();
  };

  const handleLoadMore = () => {
    if (nextCursor) {
      fetchLogs(nextCursor);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getUserDisplay = (log: AuditLog) => {
    if (!log.user) {
      return <Badge variant="secondary">System</Badge>;
    }
    const name = log.user.firstName && log.user.lastName
      ? `${log.user.firstName} ${log.user.lastName}`
      : log.user.email;
    return <span className="text-sm">{name}</span>;
  };

  const getActionBadgeVariant = (action: string) => {
    if (action.includes("created")) return "default";
    if (action.includes("updated")) return "secondary";
    if (action.includes("deleted")) return "destructive";
    if (action.includes("completed")) return "outline";
    return "default";
  };

  return (
    <>
      <SignedOut>
        <div className="flex items-center justify-center h-screen">
          <p>Please sign in to view audit logs.</p>
        </div>
      </SignedOut>
      <SignedIn>
        <div className="container mx-auto py-8 space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
            <p className="text-muted-foreground">
              Track all activity and changes in your workspace
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>
                Filter audit logs by entity type and action
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">
                    Entity Type
                  </label>
                  <Select value={entityType} onValueChange={setEntityType}>
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All types</SelectItem>
                      <SelectItem value="agent">Agent</SelectItem>
                      <SelectItem value="workflow">Workflow</SelectItem>
                      <SelectItem value="run">Run</SelectItem>
                      <SelectItem value="tool">Tool</SelectItem>
                      <SelectItem value="plugin">Plugin</SelectItem>
                      <SelectItem value="pluginTool">Plugin Tool</SelectItem>
                      <SelectItem value="schedule">Schedule</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="eventTrigger">Event Trigger</SelectItem>
                      <SelectItem value="memory">Memory</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">
                    Action
                  </label>
                  <Input
                    placeholder="e.g. agent.run.completed"
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                  />
                </div>
                <Button onClick={handleFilter}>Apply</Button>
                <Button variant="outline" onClick={handleReset}>
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity Trail</CardTitle>
              <CardDescription>
                {logs.length} log{logs.length !== 1 ? "s" : ""} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading && logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading audit logs...
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No audit logs found
                </div>
              ) : (
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(log.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getActionBadgeVariant(log.action)}>
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium">{log.entityType}</div>
                              {log.entityId && (
                                <div className="text-xs text-muted-foreground font-mono">
                                  {log.entityId.substring(0, 12)}...
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getUserDisplay(log)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {nextCursor && (
                    <div className="flex justify-center pt-4">
                      <Button
                        onClick={handleLoadMore}
                        disabled={loading}
                        variant="outline"
                      >
                        {loading ? "Loading..." : "Load More"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Details Dialog */}
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Audit Log Details</DialogTitle>
              <DialogDescription>
                {selectedLog && formatDate(selectedLog.createdAt)}
              </DialogDescription>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-1">Action</h4>
                  <Badge variant={getActionBadgeVariant(selectedLog.action)}>
                    {selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-1">Entity Type</h4>
                  <p className="text-sm">{selectedLog.entityType}</p>
                </div>
                {selectedLog.entityId && (
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Entity ID</h4>
                    <p className="text-sm font-mono text-xs break-all">
                      {selectedLog.entityId}
                    </p>
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-semibold mb-1">User</h4>
                  {getUserDisplay(selectedLog)}
                </div>
                {selectedLog.metadata && (
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Metadata</h4>
                    <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </SignedIn>
    </>
  );
}
