import "server-only";
import { randomBytes } from "node:crypto";
import { AppError, WEBHOOK_EVENTS, type WebhookEvent } from "@tracklane/core";
import { db } from "@tracklane/db";
import { assertWorkspacePermission } from "@/server/authz";

const MAX_HOOKS = 25;

export function listWebhooks(workspaceId: string) {
  return db.webhook.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      url: true,
      events: true,
      active: true,
      failureCount: true,
      createdAt: true,
      deliveries: {
        orderBy: { createdAt: "desc" },
        take: 15,
        select: {
          id: true,
          event: true,
          status: true,
          attempts: true,
          responseStatus: true,
          error: true,
          createdAt: true,
          deliveredAt: true,
          nextAttemptAt: true,
        },
      },
    },
  });
}

export type WebhookItem = Awaited<ReturnType<typeof listWebhooks>>[number];

function checkUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError("validation_failed", "Enter a full URL, like https://example.com/hooks", {
      field: "url",
    });
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new AppError("validation_failed", "Use an http(s) URL", { field: "url" });
  }
  if (url.username || url.password) {
    throw new AppError("validation_failed", "Put credentials in your receiver, not the URL", {
      field: "url",
    });
  }
  return url.toString();
}

function checkEvents(events: string[]): WebhookEvent[] {
  const valid = events.filter((e): e is WebhookEvent =>
    (WEBHOOK_EVENTS as readonly string[]).includes(e),
  );
  if (!valid.length)
    throw new AppError("validation_failed", "Pick at least one event", { field: "events" });
  return [...new Set(valid)];
}

/** Creates a hook and returns its signing secret (shown once). */
export async function createWebhook(
  workspaceId: string,
  userId: string,
  input: { url: string; events: string[] },
) {
  await assertWorkspacePermission(workspaceId, userId, "workspace:update");
  const count = await db.webhook.count({ where: { workspaceId } });
  if (count >= MAX_HOOKS)
    throw new AppError("conflict", `A workspace can have at most ${MAX_HOOKS} webhooks`);
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  const hook = await db.webhook.create({
    data: {
      workspaceId,
      url: checkUrl(input.url),
      events: checkEvents(input.events),
      secret,
      createdById: userId,
    },
    select: { id: true },
  });
  return { id: hook.id, secret };
}

export async function updateWebhook(
  workspaceId: string,
  userId: string,
  id: string,
  input: { url: string; events: string[]; active: boolean },
) {
  await assertWorkspacePermission(workspaceId, userId, "workspace:update");
  const { count } = await db.webhook.updateMany({
    where: { id, workspaceId },
    data: {
      url: checkUrl(input.url),
      events: checkEvents(input.events),
      active: input.active,
      // Turning a hook back on gives it a clean slate.
      ...(input.active ? { failureCount: 0 } : {}),
    },
  });
  if (!count) throw new AppError("not_found", "Webhook not found");
}

export async function rotateWebhookSecret(workspaceId: string, userId: string, id: string) {
  await assertWorkspacePermission(workspaceId, userId, "workspace:update");
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  const { count } = await db.webhook.updateMany({ where: { id, workspaceId }, data: { secret } });
  if (!count) throw new AppError("not_found", "Webhook not found");
  return { secret };
}

export async function deleteWebhook(workspaceId: string, userId: string, id: string) {
  await assertWorkspacePermission(workspaceId, userId, "workspace:update");
  const { count } = await db.webhook.deleteMany({ where: { id, workspaceId } });
  if (!count) throw new AppError("not_found", "Webhook not found");
}

/** Queues a "ping" delivery, whatever the hook subscribes to. */
export async function pingWebhook(workspaceId: string, userId: string, id: string) {
  await assertWorkspacePermission(workspaceId, userId, "workspace:update");
  const hook = await db.webhook.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!hook) throw new AppError("not_found", "Webhook not found");
  await db.webhookDelivery.create({
    data: {
      webhookId: id,
      event: "ping",
      payload: {
        event: "ping",
        createdAt: new Date().toISOString(),
        workspaceId,
        data: { message: "Hello from Tracklane" },
      },
    },
  });
}

/** Sends a delivery again from scratch. */
export async function redeliver(workspaceId: string, userId: string, deliveryId: string) {
  await assertWorkspacePermission(workspaceId, userId, "workspace:update");
  const { count } = await db.webhookDelivery.updateMany({
    where: { id: deliveryId, webhook: { workspaceId } },
    data: { status: "pending", attempts: 0, nextAttemptAt: new Date(), error: null },
  });
  if (!count) throw new AppError("not_found", "Delivery not found");
}
