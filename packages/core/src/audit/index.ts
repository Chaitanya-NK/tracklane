/** Every audited action, grouped for the filter on the audit log page. */
export const AUDIT_ACTIONS = {
  workspace: {
    "workspace.created": "Created the workspace",
    "workspace.updated": "Renamed the workspace",
    "workspace.auto_join_changed": "Changed domain auto-join",
  },
  members: {
    "member.invited": "Invited a member",
    "member.invitation_revoked": "Revoked an invitation",
    "member.joined": "Joined the workspace",
    "member.role_changed": "Changed a member's role",
    "member.removed": "Removed a member",
  },
  projects: {
    "project.created": "Created a project",
    "project.updated": "Updated a project",
    "project.deleted": "Deleted a project",
    "project.public_pages_changed": "Changed public pages",
  },
  security: {
    "api_token.created": "Created an API token",
    "api_token.revoked": "Revoked an API token",
    "webhook.created": "Added a webhook",
    "webhook.updated": "Updated a webhook",
    "webhook.secret_rotated": "Rotated a webhook secret",
    "webhook.deleted": "Deleted a webhook",
  },
  integrations: {
    "integration.connected": "Connected an integration",
    "integration.updated": "Updated an integration",
    "integration.disconnected": "Disconnected an integration",
    "integration.csv_imported": "Imported issues from CSV",
  },
} as const;

type Groups = typeof AUDIT_ACTIONS;
export type AuditCategory = keyof Groups;
export type AuditAction = { [G in AuditCategory]: keyof Groups[G] }[AuditCategory];

export const AUDIT_CATEGORIES = Object.keys(AUDIT_ACTIONS) as AuditCategory[];

export function auditActionLabel(action: string): string {
  for (const group of Object.values(AUDIT_ACTIONS)) {
    if (action in group) return group[action as keyof typeof group];
  }
  return action;
}

export function actionsInCategory(category: AuditCategory): string[] {
  return Object.keys(AUDIT_ACTIONS[category]);
}
