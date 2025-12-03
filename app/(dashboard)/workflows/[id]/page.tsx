"use client";

import { use } from "react";
import { WorkflowEditor } from "@/components/workflows/WorkflowEditor";
import { useSearchParams } from "next/navigation";

export default function WorkflowBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspaceId") || "";

  return (
    <div className="h-screen">
      <WorkflowEditor workflowId={resolvedParams.id} workspaceId={workspaceId} />
    </div>
  );
}
