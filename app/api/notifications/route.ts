import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

/**
 * GET /api/notifications
 * List user notifications
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get query params
    const searchParams = req.nextUrl.searchParams;
    const unread = searchParams.get("unread");
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    // Build query string
    const queryParams = new URLSearchParams();
    if (unread) queryParams.append("unread", unread);
    if (limit) queryParams.append("limit", limit);
    if (offset) queryParams.append("offset", offset);

    const queryString = queryParams.toString();
    const url = `${BACKEND_URL}/notifications${queryString ? `?${queryString}` : ""}`;

    // Forward to backend
    const response = await fetch(url, {
      headers: {
        "x-user-id": userId,
        "x-workspace-id": req.headers.get("x-workspace-id") || "",
        "x-role": req.headers.get("x-role") || "member",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || "Failed to fetch notifications" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
