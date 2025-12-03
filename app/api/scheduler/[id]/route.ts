import { getAuthContext } from "@/lib/auth-context";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  const { id } = await params;

  const res = await fetch(`http://localhost:3001/scheduler/${id}`, {
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
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  const { id } = await params;
  const body = await req.json();

  const res = await fetch(`http://localhost:3001/scheduler/${id}`, {
    method: "PATCH",
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

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  const { id } = await params;

  const res = await fetch(`http://localhost:3001/scheduler/${id}`, {
    method: "DELETE",
    headers: {
      "x-user-id": ctx.userId,
      "x-workspace-id": ctx.workspaceId,
      "x-role": ctx.membership.role,
    },
  });

  return Response.json(await res.json());
}
