import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/prisma";
import { cookies } from "next/headers";

interface AuthContext {
  userId: string;
  workspaceId: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
  };
  workspace: {
    id: string;
    name: string;
  };
  membership: {
    role: string;
  };
}

export async function getAuthContext(): Promise<AuthContext> {
  // Step 1: Authenticate via Clerk
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  // Step 2: Read active workspace cookie
  const cookieStore = await cookies();
  const workspaceCookie = cookieStore.get("activeWorkspaceId")?.value;

  // Step 3: Fetch user with workspace relations
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      workspaces: {
        include: {
          workspace: true,
        },
      },
    },
  });

  // Step 4: Handle missing user (should be rare due to webhook)
  if (!user) {
    throw new Error("User not found in database");
  }

  // Step 5: Handle no workspaces
  if (user.workspaces.length === 0) {
    throw new Error("No workspaces found");
  }

  // Step 6: Determine active workspace
  let activeWorkspaceId: string;

  if (workspaceCookie) {
    // Check if user belongs to the workspace in cookie
    const cookieWorkspace = user.workspaces.find(
      (w: any) => w.workspaceId === workspaceCookie
    );
    if (cookieWorkspace) {
      activeWorkspaceId = workspaceCookie;
    } else {
      // Cookie workspace invalid, fall back to first workspace
      activeWorkspaceId = user.workspaces[0].workspaceId;
    }
  } else {
    // No cookie, use first workspace
    activeWorkspaceId = user.workspaces[0].workspaceId;
  }

  // Step 7: Verify membership
  const membership = user.workspaces.find(
    (w: any) => w.workspaceId === activeWorkspaceId
  );

  if (!membership) {
    throw new Error("Forbidden: no workspace access");
  }

  // Step 8: Return context
  return {
    userId: user.id,
    workspaceId: activeWorkspaceId,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
    },
    workspace: {
      id: membership.workspace.id,
      name: membership.workspace.name,
    },
    membership: {
      role: membership.role,
    },
  };
}
