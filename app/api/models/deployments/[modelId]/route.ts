import { NextRequest, NextResponse } from "next/server";
import { authedApiFetchJson } from "@/lib/server-fetch";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ modelId: string }> }
) {
  try {
    const { modelId } = await params;
    const data = await authedApiFetchJson(
      `${BACKEND_URL}/models/deployments/${modelId}`
    );
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch deployments" },
      { status: error.status || 500 }
    );
  }
}
