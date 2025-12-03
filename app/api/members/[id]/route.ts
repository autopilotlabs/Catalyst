import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    const body = await request.json();
    const { id } = await params;

    const response = await fetch(
      `${BACKEND_URL}/workspace/members/${id}`,
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

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || "Failed to update member" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
