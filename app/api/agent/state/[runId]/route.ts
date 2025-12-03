import { getAuthContext } from "@/lib/auth-context";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const ctx = await getAuthContext();
  const { runId } = await params;

  const res = await fetch(`http://localhost:3001/agent/state/${runId}`, {
    headers: {
      "x-user-id": ctx.userId,
      "x-workspace-id": ctx.workspaceId,
      "x-role": ctx.membership.role,
    },
  });

  return Response.json(await res.json());
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const ctx = await getAuthContext();
  const { runId } = await params;
  const patch = await req.json();

  const res = await fetch(`http://localhost:3001/agent/state/${runId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": ctx.userId,
      "x-workspace-id": ctx.workspaceId,
      "x-role": ctx.membership.role,
    },
    body: JSON.stringify(patch),
  });

  return Response.json(await res.json());
}
