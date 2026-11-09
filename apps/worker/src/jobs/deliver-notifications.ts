import { db } from "@tracklane/db";
import { type DigestItem, notificationDigestEmail, sendEmail } from "@tracklane/email";
import * as webpush from "web-push";
import { env } from "../env";
import { logger } from "../lib/logger";
import type { JobDefinition } from "./types";

const BATCH = 500;
const absolute = (path: string) => new URL(path, env.NEXT_PUBLIC_APP_URL).toString();

const pushReady = Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
if (pushReady) {
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    env.VAPID_PRIVATE_KEY!,
  );
}

/**
 * Sends one email per person and workspace for everything pending (so a busy minute is one
 * email, not twenty). Rows are the outbox: a failure marks them failed and never blocks others.
 */
export async function deliverEmails() {
  const pending = await db.notification.findMany({
    where: { emailState: "pending" },
    orderBy: { createdAt: "asc" },
    take: BATCH,
    select: {
      id: true,
      title: true,
      body: true,
      url: true,
      userId: true,
      user: { select: { email: true } },
      workspace: { select: { name: true, slug: true } },
    },
  });
  const groups = new Map<string, typeof pending>();
  for (const row of pending) {
    const key = `${row.userId}:${row.workspace.slug}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  let sent = 0;
  for (const rows of groups.values()) {
    const [first] = rows;
    if (!first) continue;
    const ids = rows.map((r) => r.id);
    try {
      const items: DigestItem[] = rows.map((r) => ({
        title: r.title,
        body: r.body,
        url: absolute(r.url),
      }));
      await sendEmail(
        first.user.email,
        notificationDigestEmail({
          workspaceName: first.workspace.name,
          items,
          inboxUrl: absolute(`/${first.workspace.slug}/inbox`),
          settingsUrl: absolute(`/${first.workspace.slug}/settings/notifications`),
        }),
      );
      await db.notification.updateMany({
        where: { id: { in: ids } },
        data: { emailState: "sent" },
      });
      sent++;
    } catch (error) {
      logger.error({ error, userId: first.userId }, "notification email failed");
      await db.notification.updateMany({
        where: { id: { in: ids } },
        data: { emailState: "failed" },
      });
    }
  }
  return sent;
}

/** Sends pending push notifications to every browser the person turned push on in. */
export async function deliverPush() {
  if (!pushReady) {
    await db.notification.updateMany({
      where: { pushState: "pending" },
      data: { pushState: "skipped" },
    });
    return 0;
  }
  const pending = await db.notification.findMany({
    where: { pushState: "pending" },
    orderBy: { createdAt: "asc" },
    take: BATCH,
    select: {
      id: true,
      title: true,
      body: true,
      url: true,
      user: {
        select: {
          pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } },
        },
      },
    },
  });
  let sent = 0;
  for (const row of pending) {
    const subscriptions = row.user.pushSubscriptions;
    let delivered = false;
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: row.title, body: row.body, url: absolute(row.url), tag: row.id }),
          { TTL: 60 * 60 * 24 },
        );
        delivered = true;
        await db.pushSubscription.update({
          where: { id: sub.id },
          data: { lastUsedAt: new Date() },
        });
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // Gone: the browser unsubscribed or the subscription expired.
        if (status === 404 || status === 410)
          await db.pushSubscription.delete({ where: { id: sub.id } });
        else logger.warn({ status, notificationId: row.id }, "push failed");
      }
    }
    await db.notification.update({
      where: { id: row.id },
      data: { pushState: delivered ? "sent" : subscriptions.length ? "failed" : "skipped" },
    });
    if (delivered) sent++;
  }
  return sent;
}

/** Every minute: drain the email and push outboxes. */
export const deliverNotificationsJob: JobDefinition = {
  name: "notifications.deliver",
  cron: "* * * * *",
  handler: async () => {
    const [emails, pushes] = await Promise.all([deliverEmails(), deliverPush()]);
    if (emails || pushes) logger.info({ emails, pushes }, "notifications delivered");
  },
};
