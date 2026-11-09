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
    summary: "Workflow editor, approvals, custom fields, TQL functions, swimlanes, Kanban backlog",
  },
  {
    phase: 6,
    title: "Notifications & realtime",
    summary: "Inbox, mentions, watchers, email and push, live updates, presence, resolutions",
  },
  {
    phase: 7,
    title: "Reports & time",
    summary: "Burndown, velocity, flow, dashboards, workload, timesheets, SLAs",
  },
  {
    phase: 8,
    title: "Planning tools",
    summary: "Releases, goals, automation, dependencies, recurring issues, custom issue types",
    carryOver: ["Custom issue types per project"],
  },
  { phase: 9, title: "Collaboration", summary: "Docs, diagrams, whiteboard, retros, poker" },
  // Phase 10 (AI features) was dropped from the plan; the numbers stay so history lines up.
  { phase: 11, title: "API & public pages", summary: "REST API, webhooks, portal, status page" },
  { phase: 12, title: "Hardening", summary: "Audit log, SSO, i18n, accessibility, PWA" },
];

export const CURRENT_PHASE = 9;
