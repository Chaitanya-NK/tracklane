import type { IssueType, StatusCategory } from "@tracklane/core";

/** Choices for the issue form and detail fields of one project. */
export interface IssueFormOptions {
  project: { id: string; key: string; name: string; type: "scrum" | "kanban" };
  statuses: { id: string; name: string; category: StatusCategory }[];
  assignees: { id: string; name: string; email: string; image: string | null }[];
  labels: { id: string; name: string; color: string }[];
  /** Active and planned sprints (Scrum projects). */
  sprints: { id: string; name: string; state: "planned" | "active" | "completed" }[];
  /** Possible parents: epics and (for subtasks) stories, tasks and bugs. */
  parents: { id: string; number: number; title: string; type: IssueType }[];
  currentUserId: string;
  canCreate: boolean;
  canEdit: boolean;
}

export interface ProjectOption {
  key: string;
  name: string;
}
