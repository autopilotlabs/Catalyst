import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = req.headers.get("x-workspace-id");
    const role = req.headers.get("x-role");

    if (!workspaceId || !role) {
      return NextResponse.json(
        { error: "Missing workspace context" },
        { status: 400 }
      );
    }

    // Get query params
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const limit = searchParams.get("limit");

    const queryParams = new URLSearchParams();
    if (status) queryParams.append("status", status);
    if (type) queryParams.append("type", type);
    if (limit) queryParams.append("limit", limit);

    const response = await fetch(
      `${BACKEND_URL}/jobs?${queryParams.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
          "x-workspace-id": workspaceId,
          "x-role": role,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
