import { getAuthContext } from "@/lib/auth-context";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ pluginId: string; toolId: string }> }
) {
  const ctx = await getAuthContext();
  const { pluginId, toolId } = await params;

  const res = await fetch(
    `http://localhost:3001/agent/plugins/${pluginId}/tools/${toolId}`,
    {
      headers: {
        "x-user-id": ctx.userId,
        "x-workspace-id": ctx.workspaceId,
        "x-role": ctx.membership.role,
      },
    }
  );

  return Response.json(await res.json());
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ pluginId: string; toolId: string }> }
) {
  const ctx = await getAuthContext();
  const { pluginId, toolId } = await params;
  const body = await req.json();

  const res = await fetch(
    `http://localhost:3001/agent/plugins/${pluginId}/tools/${toolId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": ctx.userId,
        "x-workspace-id": ctx.workspaceId,
        "x-role": ctx.membership.role,
      },
      body: JSON.stringify(body),
    }
  );

  return Response.json(await res.json());
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ pluginId: string; toolId: string }> }
) {
  const ctx = await getAuthContext();
  const { pluginId, toolId } = await params;

  const res = await fetch(
    `http://localhost:3001/agent/plugins/${pluginId}/tools/${toolId}`,
    {
      method: "DELETE",
      headers: {
        "x-user-id": ctx.userId,
        "x-workspace-id": ctx.workspaceId,
        "x-role": ctx.membership.role,
      },
    }
  );

  return Response.json(await res.json());
}
