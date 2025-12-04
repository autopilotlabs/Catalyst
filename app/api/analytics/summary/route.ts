import { NextResponse } from "next/server";
import { authedApiFetchJson } from "@/lib/server-fetch";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

export async function GET() {
  try {
    const data = await authedApiFetchJson(`${BACKEND_URL}/analytics/summary`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching analytics summary:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: error.status || 500 }
    );
  }
}
