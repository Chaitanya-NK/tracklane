import "server-only";
import {
  DEFAULT_NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPES,
  type NotificationChannels,
  type NotificationType,
} from "@tracklane/core";
import { db } from "@tracklane/db";

export const INBOX_PAGE_SIZE = 50;

export async function listNotifications(input: {
  userId: string;
  workspaceId: string;
  unreadOnly: boolean;
}) {
  return db.notification.findMany({
    where: {
      userId: input.userId,
      workspaceId: input.workspaceId,
      ...(input.unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: INBOX_PAGE_SIZE,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      url: true,
      readAt: true,
      createdAt: true,
      actor: { select: { id: true, name: true, image: true } },
      issue: { select: { type: true } },
    },
  });
}

export type InboxItem = Awaited<ReturnType<typeof listNotifications>>[number];

export function unreadCount(userId: string, workspaceId: string) {
  return db.notification.count({ where: { userId, workspaceId, readAt: null } });
}

/** Every type with the user's channels (stored or default). */
export async function getPreferences(
  userId: string,
): Promise<Record<NotificationType, NotificationChannels>> {
  const rows = await db.notificationPreference.findMany({ where: { userId } });
  return Object.fromEntries(
    NOTIFICATION_TYPES.map((type) => {
      const row = rows.find((r) => r.type === type);
      return [
        type,
        row
          ? { inApp: row.inApp, email: row.email, push: row.push }
          : DEFAULT_NOTIFICATION_CHANNELS[type],
      ];
    }),
  ) as Record<NotificationType, NotificationChannels>;
}

export async function getWatchState(issueId: string, userId: string) {
  const [watching, count] = await Promise.all([
    db.issueWatcher.findUnique({
      where: { issueId_userId: { issueId, userId } },
      select: { userId: true },
    }),
    db.issueWatcher.count({ where: { issueId } }),
  ]);
  return { watching: Boolean(watching), count };
}

export function pushSubscriptionCount(userId: string) {
  return db.pushSubscription.count({ where: { userId } });
}
