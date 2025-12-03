import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/prisma"
import { cookies } from "next/headers"

export async function POST(req: Request) {
  const { userId } = await auth()

  if (!userId) {
    return new Response("Unauthorized", { status: 401 })
  }

  const body = await req.json()
  const { workspaceId } = body

  if (!workspaceId) {
    return new Response("Missing workspaceId", { status: 400 })
  }

  // Validate that the user belongs to this workspace
  const workspaceUser = await prisma.workspaceUser.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
  })

  if (!workspaceUser) {
    return new Response("Forbidden: You do not belong to this workspace", {
      status: 403,
    })
  }

  // Set the cookie
  const cookieStore = await cookies()
  cookieStore.set("activeWorkspaceId", workspaceId, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  })

  return NextResponse.json({ success: true })
}
