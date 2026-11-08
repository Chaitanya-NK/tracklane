import type { WorkspaceRole } from "../constants";

/**
 * Workspace-level permissions. Project-level permissions (issues, sprints…) are layered on top
 * in later phases; every check in services and API handlers goes through `can()`.
 */
export const PERMISSIONS = [
  "workspace:read",
  "workspace:update",
  "workspace:delete",
  "members:read",
  "members:invite",
  "members:update_role",
  "members:remove",
  "projects:create",
  "projects:read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const VIEWER: Permission[] = ["workspace:read", "members:read", "projects:read"];
const MEMBER: Permission[] = [...VIEWER, "projects:create"];
const ADMIN: Permission[] = [
  ...MEMBER,
  "workspace:update",
  "members:invite",
  "members:update_role",
  "members:remove",
];
const OWNER: Permission[] = [...ADMIN, "workspace:delete"];

export const ROLE_PERMISSIONS: Record<WorkspaceRole, ReadonlySet<Permission>> = {
  owner: new Set(OWNER),
  admin: new Set(ADMIN),
  member: new Set(MEMBER),
  viewer: new Set(VIEWER),
  guest: new Set<Permission>(["workspace:read", "projects:read"]),
};

export function can(role: WorkspaceRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

/** Higher number = more privileged. Used to stop people managing roles above their own. */
export const ROLE_RANK: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
  guest: 0,
};

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
  guest: "Guest",
};

export const ROLE_DESCRIPTIONS: Record<WorkspaceRole, string> = {
  owner: "Full control, including deleting the workspace",
  admin: "Manage members, settings and all projects",
  member: "Create projects and work on issues",
  viewer: "Read-only access to projects",
  guest: "Access only to projects shared with them",
};

/**
 * Can `actor` assign `targetRole` to someone who currently has `currentRole`?
 * Rules: only owners grant or remove the owner role; nobody manages a role above their own.
 */
export function canAssignRole(
  actor: WorkspaceRole,
  currentRole: WorkspaceRole,
  targetRole: WorkspaceRole,
): boolean {
  if (!can(actor, "members:update_role")) return false;
  if (currentRole === "owner" || targetRole === "owner") return actor === "owner";
  return ROLE_RANK[actor] >= ROLE_RANK[currentRole] && ROLE_RANK[actor] >= ROLE_RANK[targetRole];
}

/** Can `actor` remove a member whose role is `targetRole`? */
export function canRemoveMember(actor: WorkspaceRole, targetRole: WorkspaceRole): boolean {
  if (!can(actor, "members:remove")) return false;
  if (targetRole === "owner") return actor === "owner";
  return ROLE_RANK[actor] >= ROLE_RANK[targetRole];
}

/** Roles `actor` may hand out when inviting. */
export function invitableRoles(actor: WorkspaceRole): WorkspaceRole[] {
  if (!can(actor, "members:invite")) return [];
  const all: WorkspaceRole[] = ["owner", "admin", "member", "viewer", "guest"];
  return all.filter((role) =>
    role === "owner" ? actor === "owner" : ROLE_RANK[role] <= ROLE_RANK[actor],
  );
}
