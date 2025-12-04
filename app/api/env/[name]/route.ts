import { NextResponse } from "next/server";
import { authedApiFetch, authedApiFetchJson } from "@/lib/server-fetch";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const data = await authedApiFetchJson(`${BACKEND_URL}/env/${name}`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching environment variable:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: error.status || 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const res = await authedApiFetch(`${BACKEND_URL}/env/${name}`, {
      method: "DELETE",
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error deleting environment variable:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: error.status || 500 }
    );
  }
}
