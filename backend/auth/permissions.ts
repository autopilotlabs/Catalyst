export const PERMISSIONS = {
  workspace: {
    manage: ["owner", "admin"],
    billing: ["owner", "admin"],
    analytics: ["owner", "admin", "member"],
    workflows: ["owner", "admin", "member"],
    agents: ["owner", "admin", "member"],
    triggers: ["owner", "admin", "member"],
    memory: ["owner", "admin", "member"],
    audit: ["owner", "admin"],
  },
};

export type PermissionCategory = keyof typeof PERMISSIONS.workspace;

export function hasPermission(role: string, category: PermissionCategory): boolean {
  const allowedRoles = PERMISSIONS.workspace[category];
  return allowedRoles.includes(role);
}

export function requiresAdminOrOwner(role: string): boolean {
  return role === "owner" || role === "admin";
}

export function isOwner(role: string): boolean {
  return role === "owner";
}
