import { getAuthContext } from "@/lib/auth-context";

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  const { input, agentId } = await req.json();

  const res = await fetch("http://localhost:3001/agent/run-multi", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": ctx.userId,
      "x-workspace-id": ctx.workspaceId,
      "x-role": ctx.membership.role,
    },
    body: JSON.stringify({ input, agentId }),
  });

  return Response.json(await res.json());
}
