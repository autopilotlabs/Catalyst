import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId: paramWorkspaceId } = await params;

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

    // Parse request body
    let body = {};
    try {
      body = await req.json();
    } catch (err) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    // Forward to backend
    const backendResponse = await fetch(
      `${BACKEND_URL}/workspaces/${paramWorkspaceId}/clone`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
          "x-workspace-id": workspaceId,
          "x-role": role,
        },
        body: JSON.stringify(body),
      }
    );

    // Handle backend response
    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({
        error: "Backend request failed",
      }));

      return NextResponse.json(
        {
          error: errorData.error || errorData.message || "Failed to clone workspace",
        },
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error("Error in workspace clone API route:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
