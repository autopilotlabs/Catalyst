import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("stripe-signature");
    
    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    // Get raw body for signature verification
    const rawBody = await request.text();

    // Forward to backend with signature
    const response = await fetch(`${BACKEND_URL}/billing/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signature,
      },
      body: rawBody,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Backend webhook processing failed:", error);
      return NextResponse.json(
        { error: "Webhook processing failed" },
        { status: response.status }
      );
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json(
      { error: error.message || "Webhook processing failed" },
      { status: 500 }
    );
  }
}
