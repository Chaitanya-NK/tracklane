import type { IssueType, StatusCategory } from "@tracklane/core";

/** Choices for the issue form and detail fields of one project. */
export interface IssueFormOptions {
  project: { id: string; key: string; name: string };
  statuses: { id: string; name: string; category: StatusCategory }[];
  assignees: { id: string; name: string; email: string; image: string | null }[];
  labels: { id: string; name: string; color: string }[];
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
