import { NextRequest, NextResponse } from "next/server";
import { authedApiFetch, authedApiFetchJson } from "@/lib/server-fetch";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

export async function GET(req: NextRequest) {
  try {
    const data = await authedApiFetchJson(`${BACKEND_URL}/agent/config`);
    return NextResponse.json({ success: true, agents: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch agents" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await authedApiFetch(`${BACKEND_URL}/agent/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ success: true, agent: await data.json() });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create agent" },
      { status: error.status || 500 }
    );
  }
}
