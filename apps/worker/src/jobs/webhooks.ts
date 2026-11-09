import { lookup } from "node:dns/promises";
import {
  isPrivateAddress,
  nextWebhookRetry,
  SIGNATURE_HEADER,
  signWebhook,
  slackText,
} from "@tracklane/core";
import { db } from "@tracklane/db";
import { env } from "../env";
import { logger } from "../lib/logger";
import type { JobDefinition } from "./types";

const BATCH = 100;
const TIMEOUT_MS = 10_000;
/** Consecutive failures after which a hook is switched off. */
const DISABLE_AFTER = 20;

/** Refuses hosts that resolve to internal addresses (unless allowed for local development). */
async function assertPublicHost(url: URL) {
  if (env.WEBHOOK_ALLOW_PRIVATE_URLS) return;
  const addresses = await lookup(url.hostname, { all: true });
  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error(`${url.hostname} resolves to a private address`);
  }
}

async function send(delivery: {
  id: string;
  event: string;
  payload: unknown;
  webhook: { url: string; secret: string; format: string };
}) {
  const url = new URL(delivery.webhook.url);
  await assertPublicHost(url);
  const payload = delivery.payload as { event: string; data: Record<string, unknown> };
  const body =
    delivery.webhook.format === "slack"
      ? JSON.stringify({ text: slackText({ event: payload.event, data: payload.data ?? {} }) })
      : JSON.stringify({ id: delivery.id, ...(delivery.payload as object) });
  const res = await fetch(url, {
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      "content-type": "application/json",
      "user-agent": "Tracklane-Webhooks/1",
      "x-tracklane-event": delivery.event,
      "x-tracklane-delivery": delivery.id,
      [SIGNATURE_HEADER]: await signWebhook(delivery.webhook.secret, body),
    },
    body,
  });
  return res.status;
}

/**
 * Sends due webhook deliveries. 2xx is success; anything else is retried after 1, 5, 30, 120
 * and 360 minutes, then marked failed. A hook that keeps failing is disabled.
 */
export async function deliverWebhooks(now = new Date()) {
  const due = await db.webhookDelivery.findMany({
    where: { status: "pending", nextAttemptAt: { lte: now }, webhook: { active: true } },
    orderBy: { createdAt: "asc" },
    take: BATCH,
    select: {
      id: true,
      event: true,
      payload: true,
      attempts: true,
      webhookId: true,
      webhook: { select: { url: true, secret: true, format: true } },
    },
  });
  for (const delivery of due) {
    const attempts = delivery.attempts + 1;
    let status: number | null = null;
    let error: string | null = null;
    try {
      status = await send(delivery);
      if (status < 200 || status >= 300) error = `HTTP ${status}`;
    } catch (e) {
      error = e instanceof Error ? e.message.slice(0, 300) : "Request failed";
    }
    if (!error) {
      await db.$transaction([
        db.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "delivered",
            attempts,
            responseStatus: status,
            error: null,
            deliveredAt: new Date(),
          },
        }),
        db.webhook.update({ where: { id: delivery.webhookId }, data: { failureCount: 0 } }),
      ]);
      continue;
    }
    const retryIn = nextWebhookRetry(attempts);
    const hook = await db.webhook.update({
      where: { id: delivery.webhookId },
      data: { failureCount: { increment: 1 } },
      select: { failureCount: true },
    });
    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        attempts,
        responseStatus: status,
        error,
        ...(retryIn === undefined
          ? { status: "failed" }
          : { nextAttemptAt: new Date(Date.now() + retryIn * 60_000) }),
      },
    });
    if (hook.failureCount >= DISABLE_AFTER) {
      await db.webhook.update({ where: { id: delivery.webhookId }, data: { active: false } });
      logger.warn({ webhookId: delivery.webhookId }, "webhook disabled after repeated failures");
    }
  }
  if (due.length) logger.debug({ count: due.length }, "webhook deliveries attempted");
}

export const deliverWebhooksJob: JobDefinition = {
  name: "webhooks.deliver",
  cron: "* * * * *",
  runOnStart: true,
  handler: () => deliverWebhooks(),
};
