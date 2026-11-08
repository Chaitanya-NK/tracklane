import type { IssueType, Priority, ProjectType, StatusCategory } from "./issue";

/** Human-readable names for enum values. UI icons/colours live in the web app. */
export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  story: "Story",
  task: "Task",
  bug: "Bug",
  epic: "Epic",
  subtask: "Subtask",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  lowest: "Lowest",
  low: "Low",
  medium: "Medium",
  high: "High",
  highest: "Highest",
};

export const STATUS_CATEGORY_LABELS: Record<StatusCategory, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export const PROJECT_TYPE_LABELS: Record<ProjectType, { label: string; description: string }> = {
  scrum: { label: "Scrum", description: "Plan work in sprints from a backlog" },
  kanban: { label: "Kanban", description: "Continuous flow on a board, no sprints" },
};

/** Statuses every new project starts with. Editable in the workflow editor (Phase 5). */
export const DEFAULT_WORKFLOW: readonly { name: string; category: StatusCategory }[] = [
  { name: "To Do", category: "todo" },
  { name: "In Progress", category: "in_progress" },
  { name: "In Review", category: "in_progress" },
  { name: "Done", category: "done" },
];

/** Palette names for labels; the web app maps each to theme-aware colours. */
export const LABEL_COLORS = [
  "gray",
  "red",
  "orange",
  "amber",
  "green",
  "teal",
  "blue",
  "violet",
  "pink",
] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];

/** Issue types that can be the parent of each type (epics hold work; work holds subtasks). */
export const ALLOWED_PARENT_TYPES: Record<IssueType, readonly IssueType[]> = {
  epic: [],
  story: ["epic"],
  task: ["epic"],
  bug: ["epic"],
  subtask: ["story", "task", "bug"],
};
