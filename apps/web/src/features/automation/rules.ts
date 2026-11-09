import { PRIORITIES } from "@tracklane/core";
import { z } from "zod";

export const AUTOMATION_TRIGGERS = [
  "issue_created",
  "status_changed",
  "assignee_changed",
  "priority_changed",
  "comment_added",
  "scheduled_daily",
] as const;
export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

export const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  issue_created: "An issue is created",
  status_changed: "An issue changes status",
  assignee_changed: "The assignee changes",
  priority_changed: "The priority changes",
  comment_added: "Someone comments",
  scheduled_daily: "Every day (06:00 UTC)",
};

/** What a rule can do. Validated on save; read defensively when running. */
export const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("set_assignee"),
    to: z.union([z.literal("reporter"), z.literal("none"), z.string().min(1)]),
  }),
  z.object({ type: z.literal("set_priority"), priority: z.enum(PRIORITIES) }),
  z.object({ type: z.literal("transition"), statusId: z.string().min(1) }),
  z.object({ type: z.literal("add_label"), labelId: z.string().min(1) }),
  z.object({ type: z.literal("add_comment"), body: z.string().trim().min(1).max(2000) }),
  z.object({
    type: z.literal("notify"),
    to: z.enum(["assignee", "reporter", "watchers"]),
    message: z.string().trim().min(1).max(300),
  }),
]);
export type AutomationAction = z.infer<typeof actionSchema>;
export const actionsSchema = z.array(actionSchema).min(1, "Add at least one action").max(10);

export const ACTION_LABELS: Record<AutomationAction["type"], string> = {
  set_assignee: "Assign",
  set_priority: "Set priority",
  transition: "Move to status",
  add_label: "Add label",
  add_comment: "Add a comment",
  notify: "Send a notification",
};

export function parseActions(value: unknown): AutomationAction[] {
  const parsed = actionsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}
