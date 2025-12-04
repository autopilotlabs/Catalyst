import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";

export async function POST(req: Request) {
  try {
    // Get authentication and workspace context
    const ctx = await getAuthContext();

    // Get form data from request
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return new Response("No file provided", { status: 400 });
    }

    // Forward to backend with multipart form data
    const backendFormData = new FormData();
    backendFormData.append("file", file);

    const res = await fetch("http://localhost:3001/files/upload", {
      method: "POST",
      headers: {
        "x-user-id": ctx.userId,
        "x-workspace-id": ctx.workspaceId,
        "x-role": ctx.membership.role,
      },
      body: backendFormData,
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
