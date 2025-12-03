import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { requireRole } from "@/lib/require-role";

export async function GET() {
  try {
    // Get authentication and workspace context
    const ctx = await getAuthContext();

    // Enforce role-based access control (owners only)
    await requireRole(ctx, ["owner"]);

    // If we reach here, user is authorized
    return NextResponse.json({
      success: true,
      message: "Authorized",
      workspaceId: ctx.workspaceId,
      role: ctx.membership.role,
    });
  } catch (err: any) {
    // Handle authorization errors
    if (err.message === "Unauthorized" || err.message === "User not found in database") {
      return new Response(err.message, { status: 401 });
    }

    if (err.message.startsWith("Forbidden")) {
      return new Response(err.message, { status: 403 });
    }

    // Handle other errors
    return new Response(err.message || "Internal server error", { status: 500 });
  }
}
