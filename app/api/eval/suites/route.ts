import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";

export async function GET() {
  try {
    const ctx = await getAuthContext();

    const res = await fetch("http://localhost:3001/eval/suites", {
      headers: {
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

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const body = await req.json();

    const res = await fetch("http://localhost:3001/eval/suites", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": ctx.userId,
        "x-workspace-id": ctx.workspaceId,
        "x-role": ctx.membership.role,
      },
      body: JSON.stringify(body),
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
