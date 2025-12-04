import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export async function GET(req: NextRequest) {
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

    // Forward to backend
    const backendResponse = await fetch(`${BACKEND_URL}/imports`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
        "x-workspace-id": workspaceId,
        "x-role": role,
      },
    });

    // Handle backend response
    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({
        error: "Backend request failed",
      }));

      return NextResponse.json(
        { error: errorData.error || errorData.message || "Failed to fetch imports" },
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error("Error in imports list API route:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

