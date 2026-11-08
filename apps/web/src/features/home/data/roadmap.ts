export interface RoadmapPhase {
  phase: number;
  title: string;
  summary: string;
  /** Known gaps from earlier phases scheduled into this one, so nothing gets lost. */
  carryOver?: string[];
}

/** The build plan, shown on the home page so progress is visible inside the app itself. */
export const roadmap: RoadmapPhase[] = [
  {
    phase: 0,
    title: "Foundation",
    summary: "Monorepo, tooling, dev container, app shell, dark mode",
  },
  { phase: 1, title: "Auth & workspaces", summary: "Sign-in, onboarding, members and roles" },
  {
    phase: 2,
    title: "Projects & issues",
    summary: "Projects, issue detail, comments, attachments",
  },
  { phase: 3, title: "Board & backlog", summary: "Drag-and-drop board, sprints, quick view" },
  {
    phase: 4,
    title: "Views & search",
    summary: "List, saved views, TQL, calendar, timeline",
    carryOver: [
      "Rename and delete labels",
      "Subtasks follow their parent into sprints",
      "Hide “Leave” for a workspace's last owner",
      "Demo teammate who can sign in",
      "Sign-in redirect without the extra “/” hop",
    ],
  },
  {
    phase: 5,
    title: "Workflow & fields",
    summary: "Workflow editor, custom fields, approvals",
    carryOver: ["Board swimlanes (assignee, epic)", "Kanban backlog column"],
  },
  {
    phase: 6,
    title: "Notifications & realtime",
    summary: "Inbox, email, push, live presence",
    carryOver: ["Email verification for new accounts"],
  },
  { phase: 7, title: "Reports & time", summary: "Burndown, velocity, dashboards, SLAs" },
  { phase: 8, title: "Planning tools", summary: "Releases, goals, automation, dependencies" },
  { phase: 9, title: "Collaboration", summary: "Docs, diagrams, whiteboard, retros, poker" },
  { phase: 10, title: "AI (Gemini)", summary: "Plain-English search, duplicates, release notes" },
  { phase: 11, title: "API & public pages", summary: "REST API, webhooks, portal, status page" },
  { phase: 12, title: "Hardening", summary: "Audit log, SSO, i18n, accessibility, PWA" },
];

export const CURRENT_PHASE = 3;
