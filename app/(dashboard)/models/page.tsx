"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Model {
  id: string;
  displayName: string;
  provider: string;
  maxTokens: number;
  inputCostPer1K: number;
  outputCostPer1K: number;
}

interface InvokeResult {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
  };
  model: {
    id: string;
    provider: string;
  };
}

export default function ModelsPlaygroundPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [systemPrompt, setSystemPrompt] = useState<string>("You are a helpful assistant.");
  const [userPrompt, setUserPrompt] = useState<string>("");
  const [temperature, setTemperature] = useState<number>(0.2);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<InvokeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const res = await fetch("/api/models");
      const data = await res.json();
      setModels(data.data || []);
      if (data.data?.length > 0) {
        setSelectedModelId(data.data[0].id);
      }
    } catch (err: any) {
      console.error("Error loading models:", err);
      setError("Failed to load models");
    }
  };

  const handleRun = async () => {
    if (!userPrompt.trim()) {
      setError("Please enter a user prompt");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const messages = [];
      
      if (systemPrompt.trim()) {
        messages.push({
          role: "system",
          content: systemPrompt,
        });
      }

      messages.push({
        role: "user",
        content: userPrompt,
      });

      const res = await fetch("/api/models/invoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modelId: selectedModelId,
          messages,
          temperature,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Request failed");
      }

      const data: InvokeResult = await res.json();
      setResult(data);
    } catch (err: any) {
      console.error("Error invoking model:", err);
      setError(err.message || "Failed to invoke model");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Model Playground</h1>
        <p className="text-gray-600">
          Test and experiment with different AI models
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Input Section */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Configure model and parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                  <SelectTrigger id="model">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.displayName} ({model.provider})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="temperature">Temperature</Label>
                  <span className="text-sm text-gray-500">{temperature.toFixed(2)}</span>
                </div>
                <Slider
                  id="temperature"
                  min={0}
                  max={1}
                  step={0.01}
                  value={[temperature]}
                  onValueChange={(values) => setTemperature(values[0])}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Prompt</CardTitle>
              <CardDescription>Set the system context</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="You are a helpful assistant."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>User Prompt</CardTitle>
              <CardDescription>Enter your message</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="What is the capital of France?"
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                rows={6}
              />
              <Button onClick={handleRun} disabled={loading} className="w-full">
                {loading ? "Running..." : "Run"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Output Section */}
        <div className="space-y-6">
          {error && (
            <Card className="border-red-500">
              <CardHeader>
                <CardTitle className="text-red-500">Error</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-red-500">{error}</p>
              </CardContent>
            </Card>
          )}

          {result && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Response</CardTitle>
                  <CardDescription>
                    Model: {result.model.id} ({result.model.provider})
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded-md text-sm font-mono">
                    {result.content}
                  </pre>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Usage</CardTitle>
                  <CardDescription>Token usage and estimated cost</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Input Tokens:</span>
                    <span className="font-mono">{result.usage.inputTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Output Tokens:</span>
                    <span className="font-mono">{result.usage.outputTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Tokens:</span>
                    <span className="font-mono">{result.usage.totalTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span className="text-gray-600 font-semibold">Estimated Cost:</span>
                    <span className="font-mono font-semibold">
                      ${result.usage.cost.toFixed(6)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
