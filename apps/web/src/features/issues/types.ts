import type { IssueType, StatusCategory, TransitionRule } from "@tracklane/core";
import type { CustomFieldDef } from "@/features/custom-fields";

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
  /** The project's workflow rules, to grey out moves it won't allow. */
  transitions: { restrict: boolean; rules: TransitionRule[] };
  customFields: CustomFieldDef[];
  /** The workspace's resolutions, in order; the default one is flagged. */
  resolutions: { id: string; name: string; description: string; isDefault: boolean }[];
  /** The project's own issue types. */
  customTypes: { id: string; name: string; baseType: IssueType; color: string; icon: string }[];
  /** Unreleased versions first, then the 10 most recent released ones. */
  releases: { id: string; name: string; status: "unreleased" | "released" | "archived" }[];
  currentUserId: string;
  canCreate: boolean;
  canEdit: boolean;
}

export interface ProjectOption {
  key: string;
  name: string;
}
