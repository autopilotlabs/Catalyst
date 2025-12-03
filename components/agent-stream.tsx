"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AgentStream() {
  const [input, setInput] = useState("");
  const [content, setContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    try {
      setError(null);
      setContent("");

      // Create new agent run
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { task: input } }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        setError(`Failed to create run: ${errorText}`);
        return;
      }

      const data = await res.json();
      const runId = data.runId;

      // Start streaming
      const es = new EventSource(`/api/agent/stream/${runId}`);
      setIsStreaming(true);

      es.onmessage = (event) => {
        if (event.data === "[DONE]") {
          es.close();
          setIsStreaming(false);
          return;
        }

        try {
          const parsed = JSON.parse(event.data);
          if (parsed.content) {
            setContent((prev) => prev + parsed.content);
          }
          if (parsed.error) {
            setError(parsed.error);
            es.close();
            setIsStreaming(false);
          }
        } catch (err) {
          console.error("Failed to parse SSE data:", err);
        }
      };

      es.onerror = () => {
        es.close();
        setIsStreaming(false);
        setError("Stream connection error");
      };
    } catch (err: any) {
      setError(err.message);
      setIsStreaming(false);
    }
  };

  return (
    <div className="space-y-4 p-4 max-w-2xl mx-auto">
      <div className="space-y-2">
        <label className="block text-sm font-medium">
          Agent Task
        </label>
        <input
          className="border p-2 rounded w-full"
          placeholder="Enter a task (e.g., Write a poem about AI)..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isStreaming}
        />
        <Button onClick={start} disabled={isStreaming || !input}>
          {isStreaming ? "Streaming..." : "Start Agent"}
        </Button>
      </div>

      {error && (
        <div className="border border-red-300 bg-red-50 p-4 rounded text-red-700">
          Error: {error}
        </div>
      )}

      {content && (
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Agent Output
          </label>
          <pre className="whitespace-pre-wrap border p-4 rounded bg-gray-50 min-h-[200px]">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}
