import { getAuthContext } from "@/lib/auth-context";

export async function GET(req: Request) {
  const ctx = await getAuthContext();
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get("limit") || "10";

  const res = await fetch(`http://localhost:3001/memory/recent?limit=${limit}`, {
    headers: {
      "x-user-id": ctx.userId,
      "x-workspace-id": ctx.workspaceId,
      "x-role": ctx.membership.role,
    },
  });

  return Response.json(await res.json());
}
