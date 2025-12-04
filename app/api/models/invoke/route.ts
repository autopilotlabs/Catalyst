import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";

export async function POST(req: Request) {
  try {
    // Get authentication and workspace context
    const ctx = await getAuthContext();

    // Parse request body
    const body = await req.json();

    // Forward request to NestJS backend with auth headers
    const res = await fetch("http://localhost:3001/models/invoke", {
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
    // Handle authorization errors
    if (err.message === "Unauthorized" || err.message === "User not found in database") {
      return new Response(err.message, { status: 401 });
    }

    if (err.message.startsWith("Forbidden")) {
      return new Response(err.message, { status: 403 });
    }

    // Handle other errors
    return new Response(err.message || "Internal server error", { status: 500 });
  }
}
