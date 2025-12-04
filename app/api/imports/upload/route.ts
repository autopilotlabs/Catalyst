import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export async function POST(req: NextRequest) {
  try {
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

    // Get form data
    const formData = await req.formData();

    // Forward to backend with auth headers
    const backendResponse = await fetch(`${BACKEND_URL}/imports/upload`, {
      method: "POST",
      headers: {
        "x-user-id": userId,
        "x-workspace-id": workspaceId,
        "x-role": role,
      },
      body: formData,
    });

    // Handle backend response
    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({
        error: "Backend request failed",
      }));

      return NextResponse.json(
        { error: errorData.error || errorData.message || "Failed to upload import" },
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error("Error in imports upload API route:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

