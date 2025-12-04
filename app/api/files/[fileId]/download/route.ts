import { getAuthContext } from "@/lib/auth-context";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    // Get authentication and workspace context
    const ctx = await getAuthContext();

    const { fileId } = await params;

    // Forward request to NestJS backend and stream response
    const res = await fetch(
      `http://localhost:3001/files/${fileId}/download`,
      {
        method: "GET",
        headers: {
          "x-user-id": ctx.userId,
          "x-workspace-id": ctx.workspaceId,
          "x-role": ctx.membership.role,
        },
      }
    );

    if (!res.ok) {
      const error = await res.text();
      return new Response(error, { status: res.status });
    }

    // Stream the file directly from backend to client
    const headers = new Headers();
    
    // Copy relevant headers from backend response
    const contentType = res.headers.get("content-type");
    const contentLength = res.headers.get("content-length");
    const contentDisposition = res.headers.get("content-disposition");

    if (contentType) headers.set("Content-Type", contentType);
    if (contentLength) headers.set("Content-Length", contentLength);
    if (contentDisposition) headers.set("Content-Disposition", contentDisposition);

    return new Response(res.body, {
      status: 200,
      headers,
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
