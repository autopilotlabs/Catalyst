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

    const response = await fetch(`${BACKEND_URL}/api-keys`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
        "x-workspace-id": workspaceId,
        "x-role": role,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching API keys:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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

    const body = await req.json();

    const response = await fetch(`${BACKEND_URL}/api-keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
        "x-workspace-id": workspaceId,
        "x-role": role,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error creating API key:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
