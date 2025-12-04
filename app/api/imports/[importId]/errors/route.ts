import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ importId: string }> }
) {
  try {
    const { importId } = await params;

    // Extract auth headers
    const userId = req.headers.get("x-user-id");
    const workspaceId = req.headers.get("x-workspace-id");
    const role = req.headers.get("x-role");

    // Validate required headers
    if (!userId || !workspaceId || !role) {
      return NextResponse.json(
        { error: "Missing authentication headers" },
        { status: 401 }
      );
    }

    // Forward to backend
    const backendResponse = await fetch(
      `${BACKEND_URL}/imports/${importId}/errors`,
      {
        method: "GET",
        headers: {
          "x-user-id": userId,
          "x-workspace-id": workspaceId,
          "x-role": role,
        },
      }
    );

    // Handle backend response
    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({
        error: "Backend request failed",
      }));

      return NextResponse.json(
        { error: errorData.error || errorData.message || "Failed to download errors" },
        { status: backendResponse.status }
      );
    }

    // Get content type and disposition from backend
    const contentType =
      backendResponse.headers.get("content-type") || "application/json";
    const contentDisposition = backendResponse.headers.get(
      "content-disposition"
    );

    // Stream the file to client
    const fileBlob = await backendResponse.blob();

    const headers: Record<string, string> = {
      "Content-Type": contentType,
    };

    if (contentDisposition) {
      headers["Content-Disposition"] = contentDisposition;
    }

    return new NextResponse(fileBlob, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error("Error in import errors API route:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

