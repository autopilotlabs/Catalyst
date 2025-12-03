import { getAuthContext } from "@/lib/auth-context";

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  const { content } = await req.json();

  const res = await fetch("http://localhost:3001/memory/store", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": ctx.userId,
      "x-workspace-id": ctx.workspaceId,
      "x-role": ctx.membership.role,
    },
    body: JSON.stringify({ content }),
  });

  return Response.json(await res.json());
}
