import { NextResponse } from "next/server";
import { authedApiFetch, authedApiFetchJson } from "@/lib/server-fetch";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

export async function GET() {
  try {
    const data = await authedApiFetchJson(`${BACKEND_URL}/env`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching environment variables:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.name || !body.value) {
      return NextResponse.json(
        { error: "Name and value are required" },
        { status: 400 }
      );
    }

    const res = await authedApiFetch(`${BACKEND_URL}/env`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: body.name, value: body.value }),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error creating environment variable:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: error.status || 500 }
    );
  }
}
