import "server-only";
import {
  DEFAULT_NOTIFICATION_CHANNELS,
  formatIssueKey,
  NOTIFICATION_TYPES,
  type NotificationChannels,
  type NotificationType,
} from "@tracklane/core";
import { db } from "@tracklane/db";

export const INBOX_PAGE_SIZE = 50;

export type InboxCategory = "all" | "mentions" | "assigned" | "watching";

const CATEGORY_TYPES: Record<Exclude<InboxCategory, "all">, NotificationType[]> = {
  mentions: ["mentioned"],
  assigned: ["assigned"],
  watching: ["commented", "status_changed"],
};

export async function listNotifications(input: {
  userId: string;
  workspaceId: string;
  unreadOnly: boolean;
  category?: InboxCategory;
}) {
  const category = input.category ?? "all";
  return db.notification.findMany({
    where: {
      userId: input.userId,
      workspaceId: input.workspaceId,
      ...(input.unreadOnly ? { readAt: null } : {}),
      ...(category !== "all" ? { type: { in: CATEGORY_TYPES[category] } } : {}),
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
      issueId: true,
      issue: { select: { type: true } },
    },
  });
}

/** The issue behind a notification, with its latest comments, for the inbox preview pane. */
export async function getInboxPreview(userId: string, notificationId: string) {
  const notification = await db.notification.findFirst({
    where: { id: notificationId, userId },
    select: { issueId: true },
  });
  if (!notification?.issueId) return null;
  const issue = await db.issue.findUnique({
    where: { id: notification.issueId },
    select: {
      id: true,
      number: true,
      title: true,
      type: true,
      description: true,
      status: { select: { name: true, category: true } },
      assignee: { select: { name: true, image: true } },
      project: { select: { key: true, name: true } },
      comments: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { name: true, image: true } },
        },
      },
    },
  });
  if (!issue) return null;
  return {
    ...issue,
    key: formatIssueKey(issue.project.key, issue.number),
    comments: issue.comments.reverse(),
  };
}

export type InboxPreview = NonNullable<Awaited<ReturnType<typeof getInboxPreview>>>;

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
