import "server-only";
import {
  DEFAULT_NOTIFICATION_CHANNELS,
  formatIssueKey,
  type NotificationType,
  ROLE_RANK,
  type WorkspaceRole,
} from "@tracklane/core";
import type { Prisma } from "@tracklane/db";
import { publish, rooms } from "@/server/realtime/publish";

type Tx = Prisma.TransactionClient;

export interface NotifyInput {
  type: NotificationType;
  workspaceId: string;
  issueId: string;
  actorId: string | null;
  recipientIds: string[];
  /** Short line shown in the inbox. */
  title: string;
  body?: string;
}

/** The issue's key and workspace slug, for titles and links. */
export async function issueLabel(tx: Tx, issueId: string) {
  const issue = await tx.issue.findUniqueOrThrow({
    where: { id: issueId },
    select: {
      number: true,
      title: true,
      project: { select: { key: true } },
      workspace: { select: { slug: true } },
    },
  });
  const key = formatIssueKey(issue.project.key, issue.number);
  return { key, title: issue.title, url: `/${issue.workspace.slug}/issues/${key}` };
}

/**
 * Creates notifications for workspace members (never for the actor), following each person's
 * channel preferences. Email and push are delivered by the worker from the pending rows.
 */
export async function notify(tx: Tx, input: NotifyInput) {
  const candidates = [...new Set(input.recipientIds)].filter((id) => id && id !== input.actorId);
  if (!candidates.length) return 0;
  const [members, prefs, label] = await Promise.all([
    tx.workspaceMember.findMany({
      where: { workspaceId: input.workspaceId, userId: { in: candidates } },
      select: { userId: true },
    }),
    tx.notificationPreference.findMany({
      where: { userId: { in: candidates }, type: input.type },
    }),
    issueLabel(tx, input.issueId),
  ]);
  const now = new Date();
  const rows = members.map(({ userId }) => {
    const pref =
      prefs.find((p) => p.userId === userId) ?? DEFAULT_NOTIFICATION_CHANNELS[input.type];
    return {
      userId,
      workspaceId: input.workspaceId,
      issueId: input.issueId,
      actorId: input.actorId,
      type: input.type,
      title: input.title,
      body: (input.body ?? "").slice(0, 500),
      url: label.url,
      // Turned off in the app: still recorded (for email/push), but already read.
      readAt: pref.inApp ? null : now,
      emailState: pref.email ? ("pending" as const) : ("skipped" as const),
      pushState: pref.push ? ("pending" as const) : ("skipped" as const),
    };
  });
  const wanted = rows.filter(
    (r) => !r.readAt || r.emailState === "pending" || r.pushState === "pending",
  );
  if (!wanted.length) return 0;
  await tx.notification.createMany({ data: wanted });
  const live = wanted.filter((r) => !r.readAt);
  if (live.length) {
    await publish(tx, {
      rooms: live.map((r) => rooms.user(r.userId)),
      event: "notification:new",
      data: { title: input.title, url: label.url, workspaceId: input.workspaceId },
    });
  }
  return wanted.length;
}

/** Adds watchers (ignoring ones already watching). */
export async function watch(tx: Tx, issueId: string, userIds: (string | null | undefined)[]) {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (!ids.length) return;
  await tx.issueWatcher.createMany({
    data: ids.map((userId) => ({ issueId, userId })),
    skipDuplicates: true,
  });
}

export async function watcherIds(tx: Tx, issueId: string) {
  const rows = await tx.issueWatcher.findMany({ where: { issueId }, select: { userId: true } });
  return rows.map((r) => r.userId);
}

/** Members whose role can approve `approverRole` (capped, oldest members first). */
export async function approverIds(tx: Tx, workspaceId: string, approverRole: WorkspaceRole) {
  const roles = (Object.keys(ROLE_RANK) as WorkspaceRole[]).filter(
    (r) => r !== "guest" && ROLE_RANK[r] >= ROLE_RANK[approverRole],
  );
  const members = await tx.workspaceMember.findMany({
    where: { workspaceId, role: { in: roles } },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

/** Name for titles ("Priya"), falling back to "Someone". */
export async function actorName(tx: Tx, actorId: string | null) {
  if (!actorId) return "Someone";
  const user = await tx.user.findUnique({ where: { id: actorId }, select: { name: true } });
  return user?.name ?? "Someone";
}
