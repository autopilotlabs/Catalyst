import { getAuthContext } from "@/lib/auth-context";

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  const body = await req.json();

  const res = await fetch("http://localhost:3001/events/emit", {
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
