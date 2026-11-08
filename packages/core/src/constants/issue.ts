/**
 * Domain constants shared by the web app, the REST API, the worker and the realtime server.
 * Keep these as `as const` tuples so they double as TypeScript union types and zod enums.
 */

export const ISSUE_TYPES = ["story", "task", "bug", "epic", "subtask"] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const PRIORITIES = ["lowest", "low", "medium", "high", "highest"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Every workflow status belongs to one of these categories (drives colors, reports and "done"). */
export const STATUS_CATEGORIES = ["todo", "in_progress", "done"] as const;
export type StatusCategory = (typeof STATUS_CATEGORIES)[number];

export const PROJECT_TYPES = ["scrum", "kanban"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const WORKSPACE_ROLES = ["owner", "admin", "member", "viewer", "guest"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const SPRINT_STATES = ["planned", "active", "completed"] as const;
export type SprintState = (typeof SPRINT_STATES)[number];
