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

type Role = "owner" | "admin" | "member";

export async function requireRole(
  ctx: AuthContext,
  allowedRoles: Role[]
): Promise<void> {
  const userRole = ctx.membership.role;

  if (!allowedRoles.includes(userRole as Role)) {
    throw new Error("Forbidden: insufficient permissions");
  }
}
