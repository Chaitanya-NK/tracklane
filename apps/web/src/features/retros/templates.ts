export interface RetroColumn {
  id: string;
  title: string;
  /** Cards here are action items and can become issues. */
  actions?: boolean;
}

export const RETRO_TEMPLATES = {
  classic: {
    label: "Went well / To improve",
    columns: [
      { id: "well", title: "Went well" },
      { id: "improve", title: "To improve" },
      { id: "actions", title: "Action items", actions: true },
    ],
  },
  ssc: {
    label: "Start / Stop / Continue",
    columns: [
      { id: "start", title: "Start" },
      { id: "stop", title: "Stop" },
      { id: "continue", title: "Continue" },
      { id: "actions", title: "Action items", actions: true },
    ],
  },
  fourls: {
    label: "Liked / Learned / Lacked / Longed for",
    columns: [
      { id: "liked", title: "Liked" },
      { id: "learned", title: "Learned" },
      { id: "lacked", title: "Lacked" },
      { id: "longed", title: "Longed for" },
      { id: "actions", title: "Action items", actions: true },
    ],
  },
} satisfies Record<string, { label: string; columns: RetroColumn[] }>;

export type RetroTemplate = keyof typeof RETRO_TEMPLATES;

export const RETRO_PHASES = ["brainstorm", "vote", "discuss", "closed"] as const;
export type RetroPhase = (typeof RETRO_PHASES)[number];

export const PHASE_LABELS: Record<RetroPhase, string> = {
  brainstorm: "Brainstorm",
  vote: "Vote",
  discuss: "Discuss",
  closed: "Closed",
};

export const PHASE_HINTS: Record<RetroPhase, string> = {
  brainstorm: "Add cards. Everyone else's stay hidden until voting starts.",
  vote: "Vote for the cards worth discussing. Totals show when discussion starts.",
  discuss: "Cards are sorted by votes. Capture action items and turn them into issues.",
  closed: "This retro is closed and read-only.",
};
