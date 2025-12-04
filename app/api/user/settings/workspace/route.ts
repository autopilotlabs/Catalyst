import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

export async function GET() {
  try {
    const ctx = await getAuthContext();

    const response = await fetch(`${BACKEND_URL}/user/settings/workspace`, {
      headers: {
        "x-user-id": ctx.userId,
        "x-workspace-id": ctx.workspaceId,
        "x-role": ctx.membership.role,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || "Failed to fetch workspace settings" },
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

export async function PATCH(req: Request) {
  try {
    const ctx = await getAuthContext();
    const body = await req.json();

    if (!body.workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/user/settings/workspace`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": ctx.userId,
        "x-workspace-id": ctx.workspaceId,
        "x-role": ctx.membership.role,
      },
      body: JSON.stringify({ workspaceId: body.workspaceId }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || "Failed to update workspace settings" },
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
