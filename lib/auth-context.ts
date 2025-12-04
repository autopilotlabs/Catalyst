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

  // Step 2: Read active workspace cookie (fallback only)
  const cookieStore = await cookies();
  const workspaceCookie = cookieStore.get("activeWorkspaceId")?.value;

  // Step 3: Fetch user with workspace relations and settings
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      workspaces: {
        include: {
          workspace: true,
        },
      },
      settings: {
        select: {
          defaultWorkspaceId: true,
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

  // Step 6: Determine active workspace (priority: cookie > defaultWorkspaceId > first workspace)
  let activeWorkspaceId: string;

  if (workspaceCookie) {
    // Check if user belongs to the workspace in cookie
    const cookieWorkspace = user.workspaces.find(
      (w: any) => w.workspaceId === workspaceCookie
    );
    if (cookieWorkspace) {
      activeWorkspaceId = workspaceCookie;
    } else if (user.settings?.defaultWorkspaceId) {
      // Cookie invalid, try defaultWorkspaceId
      const defaultWorkspace = user.workspaces.find(
        (w: any) => w.workspaceId === user.settings?.defaultWorkspaceId
      );
      activeWorkspaceId = defaultWorkspace
        ? user.settings.defaultWorkspaceId
        : user.workspaces[0].workspaceId;
    } else {
      // No default, use first workspace
      activeWorkspaceId = user.workspaces[0].workspaceId;
    }
  } else if (user.settings?.defaultWorkspaceId) {
    // No cookie, try defaultWorkspaceId
    const defaultWorkspace = user.workspaces.find(
      (w: any) => w.workspaceId === user.settings?.defaultWorkspaceId
    );
    activeWorkspaceId = defaultWorkspace
      ? user.settings.defaultWorkspaceId
      : user.workspaces[0].workspaceId;
  } else {
    // No cookie or default, use first workspace
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

/**
 * Get active workspace details for the current user
 */
export async function getActiveWorkspace() {
  const ctx = await getAuthContext();
  
  const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";
  
  const res = await fetch(`${BACKEND_URL}/user/settings/workspace`, {
    headers: {
      "x-user-id": ctx.userId,
      "x-workspace-id": ctx.workspaceId,
      "x-role": ctx.membership.role,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch active workspace");
  }

  const data = await res.json();
  return data.data;
}
