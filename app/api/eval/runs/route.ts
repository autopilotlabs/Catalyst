import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const suiteId = searchParams.get("suiteId");

    const url = new URL("http://localhost:3001/eval/runs");
    if (suiteId) {
      url.searchParams.set("suiteId", suiteId);
    }

    const res = await fetch(url, {
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
