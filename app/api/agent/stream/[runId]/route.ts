import { getAuthContext } from "@/lib/auth-context";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    // Get authentication and workspace context
    const ctx = await getAuthContext();
    const { runId } = await params;

    // Forward request to NestJS backend with auth headers
    const response = await fetch(
      `http://localhost:3001/agent/stream/${runId}`,
      {
        headers: {
          "x-user-id": ctx.userId,
          "x-workspace-id": ctx.workspaceId,
          "x-role": ctx.membership.role,
        },
      }
    );

    // Return SSE stream
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
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
