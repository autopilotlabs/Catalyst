import { getAuthContext } from "@/lib/auth-context";

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  const { query, limit } = await req.json();

  const res = await fetch("http://localhost:3001/memory/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": ctx.userId,
      "x-workspace-id": ctx.workspaceId,
      "x-role": ctx.membership.role,
    },
    body: JSON.stringify({ query, limit }),
  });

  return Response.json(await res.json());
}
