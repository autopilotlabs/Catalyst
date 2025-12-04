import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const ctx = await getAuthContext();
    const { runId } = await params;

    const res = await fetch(`${BACKEND_URL}/eval/runs/${runId}/baseline`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": ctx.userId,
        "x-workspace-id": ctx.workspaceId,
        "x-role": ctx.membership.role,
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    if (err.message === "Unauthorized" || err.message === "User not found in database") {
      return new Response(err.message, { status: 401 });
    }
    if (err.message.startsWith("Forbidden")) {
      return new Response(err.message, { status: 403 });
    }
    return new Response(err.message || "Internal server error", { status: 500 });
  }
}
