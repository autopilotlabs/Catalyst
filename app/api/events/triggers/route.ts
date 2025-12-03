import { getAuthContext } from "@/lib/auth-context";

export async function GET() {
  const ctx = await getAuthContext();

  const res = await fetch("http://localhost:3001/events/triggers", {
    headers: {
      "x-user-id": ctx.userId,
      "x-workspace-id": ctx.workspaceId,
      "x-role": ctx.membership.role,
    },
  });

  return Response.json(await res.json());
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  const body = await req.json();

  const res = await fetch("http://localhost:3001/events/triggers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": ctx.userId,
      "x-workspace-id": ctx.workspaceId,
      "x-role": ctx.membership.role,
    },
    body: JSON.stringify(body),
  });

  return Response.json(await res.json());
}
