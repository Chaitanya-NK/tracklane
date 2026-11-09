/** Notification types; keep in sync with the NotificationType enum in the Prisma schema. */
export const NOTIFICATION_TYPES = [
  "assigned",
  "mentioned",
  "commented",
  "status_changed",
  "approval_requested",
  "approval_decided",
  "sla_at_risk",
  "sla_breached",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_CHANNELS = ["inApp", "email", "push"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export type NotificationChannels = Record<NotificationChannel, boolean>;

export const NOTIFICATION_TYPE_LABELS: Record<
  NotificationType,
  { label: string; description: string }
> = {
  assigned: { label: "Assigned to me", description: "Someone assigns an issue to you" },
  mentioned: { label: "Mentions", description: "Someone @mentions you in a comment" },
  commented: { label: "Comments", description: "New comments on issues you watch" },
  status_changed: {
    label: "Status changes",
    description: "Issues you watch move to another status",
  },
  approval_requested: { label: "Approval requests", description: "A move needs your approval" },
  approval_decided: {
    label: "Approval decisions",
    description: "Your request is approved or rejected",
  },
  sla_at_risk: { label: "SLA at risk", description: "An issue you own is close to its SLA target" },
  sla_breached: { label: "SLA breached", description: "An issue you own missed its SLA target" },
};

/** Used when the user hasn't changed a type. Email only for things addressed to you. */
export const DEFAULT_NOTIFICATION_CHANNELS: Record<NotificationType, NotificationChannels> = {
  assigned: { inApp: true, email: true, push: true },
  mentioned: { inApp: true, email: true, push: true },
  commented: { inApp: true, email: false, push: false },
  status_changed: { inApp: true, email: false, push: false },
  approval_requested: { inApp: true, email: true, push: true },
  approval_decided: { inApp: true, email: true, push: false },
  sla_at_risk: { inApp: true, email: false, push: true },
  sla_breached: { inApp: true, email: true, push: true },
};

/** Resolutions every new workspace starts with; admins change them in Settings → Resolutions. */
export const DEFAULT_RESOLUTIONS = [
  { name: "Done", description: "The work is complete", isDefault: true },
  { name: "Fixed", description: "A fix has been made" },
  { name: "Won't fix", description: "It won't be addressed" },
  { name: "Duplicate", description: "Covered by another issue" },
  { name: "Cannot reproduce", description: "The problem couldn't be reproduced" },
  { name: "Works as designed", description: "Behaving as intended" },
] as const;

/**
 * @mentions in Markdown are stored as `@[Name](user:<id>)`, so names with spaces survive and
 * renaming a user doesn't break old comments.
 */
export const MENTION_PATTERN = /@\[([^\]\n]{1,80})\]\(user:([A-Za-z0-9_-]{1,64})\)/g;

/** User ids mentioned in a Markdown text, without duplicates. */
export function extractMentions(markdown: string): string[] {
  return [...new Set([...markdown.matchAll(MENTION_PATTERN)].map((m) => m[2]!))];
}
