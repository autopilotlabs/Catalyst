import { NextRequest, NextResponse } from "next/server";
import { authedApiFetch, authedApiFetchJson } from "@/lib/server-fetch";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ modelId: string }> }
) {
  try {
    const { modelId } = await params;
    const data = await authedApiFetchJson(
      `${BACKEND_URL}/models/versions/${modelId}`
    );
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch versions" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ modelId: string }> }
) {
  try {
    const { modelId } = await params;
    const body = await req.json();
    const data = await authedApiFetch(
      `${BACKEND_URL}/models/versions/${modelId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    return NextResponse.json(await data.json());
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create version" },
      { status: error.status || 500 }
    );
  }
}
