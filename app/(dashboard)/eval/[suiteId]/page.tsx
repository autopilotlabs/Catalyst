"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

interface Suite {
  id: string;
  name: string;
  description?: string;
}

interface Test {
  id: string;
  name: string;
  input: any;
  expected: any;
  createdAt: string;
}

interface Model {
  id: string;
  displayName: string;
}

export default function EvalSuiteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const suiteId = params.suiteId as string;

  const [suite, setSuite] = useState<Suite | null>(null);
  const [tests, setTests] = useState<Test[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);

  const [testName, setTestName] = useState("");
  const [testInput, setTestInput] = useState("");
  const [testExpected, setTestExpected] = useState("");
  const [addingTest, setAddingTest] = useState(false);

  const [selectedModel, setSelectedModel] = useState("");
  const [runningEval, setRunningEval] = useState(false);

  useEffect(() => {
    loadData();
  }, [suiteId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [suiteRes, testsRes, modelsRes] = await Promise.all([
        fetch(`/api/eval/suites/${suiteId}`),
        fetch(`/api/eval/suites/${suiteId}/tests`),
        fetch("/api/models"),
      ]);

      const suiteData = await suiteRes.json();
      const testsData = await testsRes.json();
      const modelsData = await modelsRes.json();

      setSuite(suiteData.data);
      setTests(testsData.data || []);
      setModels(modelsData.data || []);
      if (modelsData.data?.length > 0) {
        setSelectedModel(modelsData.data[0].id);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testName.trim() || !testInput.trim()) return;

    try {
      setAddingTest(true);
      let inputObj;
      let expectedObj;

      try {
        inputObj = JSON.parse(testInput);
      } catch {
        inputObj = testInput;
      }

      if (testExpected.trim()) {
        try {
          expectedObj = JSON.parse(testExpected);
        } catch {
          expectedObj = testExpected;
        }
      }

      const res = await fetch(`/api/eval/suites/${suiteId}/tests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: testName,
          input: inputObj,
          expected: expectedObj,
        }),
      });

      if (!res.ok) throw new Error("Failed to add test");

      setTestName("");
      setTestInput("");
      setTestExpected("");
      loadData();
    } catch (error) {
      console.error("Error adding test:", error);
    } finally {
      setAddingTest(false);
    }
  };

  const handleRunEval = async () => {
    if (!selectedModel) return;

    try {
      setRunningEval(true);
      const res = await fetch(`/api/eval/suites/${suiteId}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ modelId: selectedModel }),
      });

      if (!res.ok) throw new Error("Failed to start eval");

      const data = await res.json();
      router.push(`/eval/runs/${data.data.runId}`);
    } catch (error) {
      console.error("Error running eval:", error);
    } finally {
      setRunningEval(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!suite) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-red-500">Suite not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{suite.name}</h1>
        {suite.description && (
          <p className="text-gray-600">{suite.description}</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run Evaluation</CardTitle>
          <CardDescription>Select a model to test against this suite</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label>Model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleRunEval}
              disabled={runningEval || tests.length === 0}
            >
              {runningEval ? "Starting..." : "Run Evaluation"}
            </Button>
          </div>
          {tests.length === 0 && (
            <p className="text-sm text-amber-600">
              Add at least one test before running an evaluation
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Test</CardTitle>
          <CardDescription>Create a new test case for this suite</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddTest} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="testName">Test Name</Label>
              <Input
                id="testName"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="e.g., Greeting response"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="testInput">Input (JSON or text)</Label>
              <Textarea
                id="testInput"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder='[{"role": "user", "content": "Hello!"}]'
                rows={3}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="testExpected">Expected Output (optional, JSON or text)</Label>
              <Textarea
                id="testExpected"
                value={testExpected}
                onChange={(e) => setTestExpected(e.target.value)}
                placeholder="Expected response..."
                rows={3}
              />
            </div>
            <Button type="submit" disabled={addingTest}>
              {addingTest ? "Adding..." : "Add Test"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tests ({tests.length})</CardTitle>
          <CardDescription>All test cases in this suite</CardDescription>
        </CardHeader>
        <CardContent>
          {tests.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No tests yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Has Expected</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tests.map((test) => (
                  <TableRow key={test.id}>
                    <TableCell className="font-medium">{test.name}</TableCell>
                    <TableCell>
                      {test.expected ? (
                        <Badge variant="secondary">Yes</Badge>
                      ) : (
                        <Badge variant="outline">No</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(test.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
