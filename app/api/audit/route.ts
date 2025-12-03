import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";

export async function GET(request: NextRequest) {
  try {
    // Get auth context
    const ctx = await getAuthContext();

    // Extract query params
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType") || undefined;
    const action = searchParams.get("action") || undefined;
    const limit = searchParams.get("limit") || "50";
    const cursor = searchParams.get("cursor") || undefined;

    // Build query params for backend
    const params = new URLSearchParams();
    if (entityType) params.append("entityType", entityType);
    if (action) params.append("action", action);
    params.append("limit", limit);
    if (cursor) params.append("cursor", cursor);

    // Proxy to backend
    const backendUrl = `http://localhost:3001/audit?${params.toString()}`;
    const response = await fetch(backendUrl, {
      method: "GET",
      headers: {
        "x-user-id": ctx.userId,
        "x-workspace-id": ctx.workspaceId,
        "x-role": ctx.membership.role,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || "Failed to fetch audit logs" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
