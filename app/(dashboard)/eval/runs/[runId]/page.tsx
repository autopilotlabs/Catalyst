"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Run {
  id: string;
  modelId: string;
  status: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  createdAt: string;
  completedAt?: string;
  regression: boolean;
  regressionDelta?: number | null;
  suite: {
    id: string;
    name: string;
    description?: string;
  };
  results: Result[];
}

interface ComparisonData {
  passRate: number;
  baselinePassRate: number | null;
  regression: boolean;
  regressionDelta: number | null;
  baseline: any | null;
}

interface Result {
  id: string;
  passed: boolean;
  error?: string;
  durationMs: number;
  actual: any;
  expected: any;
  test: {
    id: string;
    name: string;
    input: any;
    expected: any;
  };
}

export default function EvalRunDetailPage() {
  const params = useParams();
  const runId = params.runId as string;

  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loadingComparison, setLoadingComparison] = useState(true);
  const [settingBaseline, setSettingBaseline] = useState(false);

  useEffect(() => {
    loadRun();
    loadComparison();
    const interval = setInterval(() => {
      loadRun();
      loadComparison();
    }, 3000);

    return () => clearInterval(interval);
  }, [runId]);

  const loadRun = async () => {
    try {
      const res = await fetch(`/api/eval/runs/${runId}`);
      const data = await res.json();
      setRun(data.data);
      setLoading(false);
    } catch (error) {
      console.error("Error loading run:", error);
      setLoading(false);
    }
  };

  const loadComparison = async () => {
    try {
      const res = await fetch(`/api/eval/runs/${runId}/compare`);
      const data = await res.json();
      setComparison(data.data);
      setLoadingComparison(false);
    } catch (error) {
      console.error("Error loading comparison:", error);
      setLoadingComparison(false);
    }
  };

  const handleSetBaseline = async () => {
    if (!run || run.status !== "success") return;

    try {
      setSettingBaseline(true);
      const res = await fetch(`/api/eval/runs/${runId}/baseline`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Failed to set baseline");

      await loadComparison();
      alert("Baseline set successfully!");
    } catch (error) {
      console.error("Error setting baseline:", error);
      alert("Failed to set baseline");
    } finally {
      setSettingBaseline(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-gray-500">Loading run...</p>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-red-500">Run not found</p>
      </div>
    );
  }

  const passRate =
    run.totalTests > 0
      ? ((run.passedTests / run.totalTests) * 100).toFixed(1)
      : "0";

  const comparisonPassRate = comparison ? (comparison.passRate * 100).toFixed(1) : null;
  const baselinePassRate = comparison?.baselinePassRate != null ? (comparison.baselinePassRate * 100).toFixed(1) : null;
  const regressionDelta = comparison?.regressionDelta != null ? (comparison.regressionDelta * 100).toFixed(1) : null;
  const hasRegression = comparison?.regression ?? false;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Eval Run Results</h1>
          <p className="text-gray-600">
            Suite:{" "}
            <Link href={`/eval/${run.suite.id}`} className="text-blue-600 hover:underline">
              {run.suite.name}
            </Link>
          </p>
        </div>
        <div className="flex gap-2">
          {run.status === "success" && (
            <Button onClick={handleSetBaseline} disabled={settingBaseline}>
              {settingBaseline ? "Setting..." : "Mark as Baseline"}
            </Button>
          )}
          <Link href={`/eval/${run.suite.id}`}>
            <Button variant="outline">Back to Suite</Button>
          </Link>
        </div>
      </div>

      {!loadingComparison && comparison && (
        <Card>
          <CardHeader>
            <CardTitle>Regression Analysis</CardTitle>
            <CardDescription>Comparison with baseline performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4">
              {hasRegression ? (
                <Badge variant="destructive" className="text-base">
                  ⚠️ Regression Detected (-{regressionDelta}pp)
                </Badge>
              ) : baselinePassRate != null ? (
                <Badge className="bg-green-600 text-base">
                  ✓ No Regression (Δ {regressionDelta}pp)
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-base">
                  No Baseline Set
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Current Pass Rate</div>
                <div className="text-2xl font-bold">{comparisonPassRate}%</div>
              </div>
              {baselinePassRate != null && (
                <>
                  <div>
                    <div className="text-gray-600">Baseline Pass Rate</div>
                    <div className="text-2xl font-bold">{baselinePassRate}%</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Delta</div>
                    <div className={`text-2xl font-bold ${hasRegression ? "text-red-600" : "text-green-600"}`}>
                      {regressionDelta}pp
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant={
                run.status === "success"
                  ? "default"
                  : run.status === "running"
                  ? "secondary"
                  : "destructive"
              }
            >
              {run.status}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{run.totalTests}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Passed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {run.passedTests}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {run.failedTests}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test Results</CardTitle>
          <CardDescription>
            Model: {run.modelId} | Pass Rate: {passRate}%
          </CardDescription>
        </CardHeader>
        <CardContent>
          {run.results.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              {run.status === "running" ? "Running tests..." : "No results yet"}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test Name</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {run.results.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell className="font-medium">
                      {result.test.name}
                    </TableCell>
                    <TableCell>
                      {result.passed ? (
                        <Badge className="bg-green-600">Passed</Badge>
                      ) : (
                        <Badge variant="destructive">Failed</Badge>
                      )}
                    </TableCell>
                    <TableCell>{result.durationMs}ms</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedResult(result)}
                      >
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedResult && (
        <Card>
          <CardHeader>
            <CardTitle>Test Details: {selectedResult.test.name}</CardTitle>
            <CardDescription>
              {selectedResult.passed ? "Passed" : "Failed"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedResult.error && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-red-600">Error</Label>
                <pre className="bg-red-50 p-3 rounded text-sm text-red-800 overflow-x-auto">
                  {selectedResult.error}
                </pre>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Input</Label>
              <pre className="bg-gray-50 p-3 rounded text-sm overflow-x-auto">
                {JSON.stringify(selectedResult.test.input, null, 2)}
              </pre>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Actual Output</Label>
              <pre className="bg-gray-50 p-3 rounded text-sm overflow-x-auto">
                {JSON.stringify(selectedResult.actual, null, 2)}
              </pre>
            </div>

            {selectedResult.expected && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Expected Output</Label>
                <pre className="bg-gray-50 p-3 rounded text-sm overflow-x-auto">
                  {JSON.stringify(selectedResult.expected, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`block text-sm font-medium ${className || ""}`}>{children}</div>;
}
