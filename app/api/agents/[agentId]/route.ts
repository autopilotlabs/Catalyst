import { NextRequest, NextResponse } from "next/server";
import { authedApiFetch, authedApiFetchJson } from "@/lib/server-fetch";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const data = await authedApiFetchJson(`${BACKEND_URL}/agent/config/${agentId}`);
    return NextResponse.json({ success: true, agent: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch agent" },
      { status: error.status || 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const body = await req.json();
    const data = await authedApiFetch(`${BACKEND_URL}/agent/config/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ success: true, agent: await data.json() });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update agent" },
      { status: error.status || 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    await authedApiFetch(`${BACKEND_URL}/agent/config/${agentId}`, {
      method: "DELETE",
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete agent" },
      { status: error.status || 500 }
    );
  }
}
