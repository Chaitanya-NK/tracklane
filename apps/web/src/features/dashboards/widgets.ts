import { z } from "zod";

/** Dashboard widget types and their settings. Stored as JSON on the dashboard. */
export const WIDGET_TYPES = [
  "count",
  "breakdown",
  "list",
  "created_resolved",
  "burndown",
  "velocity",
  "sla",
] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

export const WIDGET_LABELS: Record<WidgetType, { label: string; description: string }> = {
  count: { label: "Number", description: "How many issues match a query" },
  breakdown: { label: "Breakdown", description: "Issues from a query grouped by a field" },
  list: { label: "Issue list", description: "The first issues from a query" },
  created_resolved: { label: "Created vs resolved", description: "Daily trend for a query" },
  burndown: { label: "Sprint burndown", description: "The active sprint of a project" },
  velocity: { label: "Velocity", description: "Committed vs completed points of a project" },
  sla: { label: "SLA summary", description: "Met rate and risks for a project's SLAs" },
};

export const BREAKDOWN_FIELD_OPTIONS = [
  "status",
  "statusCategory",
  "priority",
  "assignee",
  "type",
  "resolution",
  "label",
] as const;

export const widgetSchema = z.object({
  id: z.string().min(1).max(40),
  title: z.string().trim().min(1).max(80),
  size: z.enum(["half", "full"]),
  type: z.enum(WIDGET_TYPES),
  config: z.object({
    query: z.string().max(2000).optional(),
    field: z.enum(BREAKDOWN_FIELD_OPTIONS).optional(),
    limit: z.number().int().min(1).max(20).optional(),
    days: z.number().int().min(7).max(180).optional(),
    projectKey: z.string().max(20).optional(),
  }),
});
export type Widget = z.infer<typeof widgetSchema>;

export const widgetsSchema = z.array(widgetSchema).max(24);

/** Query-based widgets need a query; project ones a project. */
export function widgetNeeds(type: WidgetType) {
  return {
    query: ["count", "breakdown", "list", "created_resolved"].includes(type),
    project: ["burndown", "velocity", "sla"].includes(type),
  };
}

/** Reads stored JSON defensively (bad rows are dropped, not fatal). */
export function parseWidgets(value: unknown): Widget[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((w) => {
    const parsed = widgetSchema.safeParse(w);
    return parsed.success ? [parsed.data] : [];
  });
}
