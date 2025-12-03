import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/prisma";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Fetch user from Prisma with workspace relations
  let user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      workspaces: {
        include: {
          workspace: true,
        },
      },
    },
  });

  // Handle race condition: if user doesn't exist in DB yet, create it
  if (!user) {
    const clerkUser = await currentUser();

    if (!clerkUser) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Create user record mirroring Clerk data (no workspace creation here)
    user = await prisma.user.create({
      data: {
        id: userId,
        email: clerkUser.emailAddresses[0]?.emailAddress || "",
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        imageUrl: clerkUser.imageUrl,
      },
      include: {
        workspaces: {
          include: {
            workspace: true,
          },
        },
      },
    });
  }

  // Transform to response format
  const response = {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
    },
    workspaces: user.workspaces.map((wu) => ({
      id: wu.workspace.id,
      name: wu.workspace.name,
      role: wu.role,
    })),
  };

  return NextResponse.json(response);
}
