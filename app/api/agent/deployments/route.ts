import { NextRequest, NextResponse } from "next/server";
import { authedApiFetch } from "@/lib/server-fetch";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await authedApiFetch(`${BACKEND_URL}/agent/deployments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await data.json());
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create deployment" },
      { status: error.status || 500 }
    );
  }
}
