import "server-only";
import {
  AppError,
  NOTIFICATION_TYPES,
  type NotificationChannels,
  type NotificationType,
} from "@tracklane/core";
import { db } from "@tracklane/db";
import { assertWorkspacePermission } from "@/server/authz";

export async function markRead(input: { userId: string; workspaceId: string; ids?: string[] }) {
  const { count } = await db.notification.updateMany({
    where: {
      userId: input.userId,
      workspaceId: input.workspaceId,
      readAt: null,
      ...(input.ids ? { id: { in: input.ids } } : {}),
    },
    data: { readAt: new Date() },
  });
  return count;
}

export async function markUnread(input: { userId: string; id: string }) {
  await db.notification.updateMany({
    where: { id: input.id, userId: input.userId },
    data: { readAt: null },
  });
}

export async function setPreference(input: {
  userId: string;
  type: NotificationType;
  channels: NotificationChannels;
}) {
  if (!NOTIFICATION_TYPES.includes(input.type))
    throw new AppError("validation_failed", "Unknown type");
  await db.notificationPreference.upsert({
    where: { userId_type: { userId: input.userId, type: input.type } },
    update: input.channels,
    create: { userId: input.userId, type: input.type, ...input.channels },
  });
}

export async function setWatching(input: { issueId: string; userId: string; watching: boolean }) {
  const issue = await db.issue.findUnique({
    where: { id: input.issueId },
    select: { workspaceId: true },
  });
  if (!issue) throw new AppError("not_found", "Issue not found");
  await assertWorkspacePermission(issue.workspaceId, input.userId, "projects:read");
  if (input.watching) {
    await db.issueWatcher.createMany({
      data: [{ issueId: input.issueId, userId: input.userId }],
      skipDuplicates: true,
    });
  } else {
    await db.issueWatcher.deleteMany({ where: { issueId: input.issueId, userId: input.userId } });
  }
}

export async function savePushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
}) {
  const url = new URL(input.endpoint);
  if (url.protocol !== "https:")
    throw new AppError("validation_failed", "Push endpoints must be https");
  await db.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    update: {
      userId: input.userId,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent,
    },
    create: input,
  });
}

export async function deletePushSubscription(input: { userId: string; endpoint: string }) {
  await db.pushSubscription.deleteMany({
    where: { userId: input.userId, endpoint: input.endpoint },
  });
}
