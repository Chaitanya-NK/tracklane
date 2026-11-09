import "server-only";
import { formatIssueKey, type WebhookEvent } from "@tracklane/core";
import type { Prisma } from "@tracklane/db";
import { env } from "@/env";

type Tx = Prisma.TransactionClient;

/**
 * Writes one delivery per subscribed, active hook inside the caller's transaction (an outbox):
 * nothing is sent for changes that roll back. The worker sends and retries them.
 */
export async function enqueueWebhooks(
  tx: Tx,
  workspaceId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
) {
  const hooks = await tx.webhook.findMany({
    where: { workspaceId, active: true, events: { has: event } },
    select: { id: true },
  });
  if (!hooks.length) return;
  const createdAt = new Date().toISOString();
  await tx.webhookDelivery.createMany({
    data: hooks.map((h) => ({
      webhookId: h.id,
      event,
      payload: { event, createdAt, workspaceId, data } as Prisma.InputJsonValue,
    })),
  });
}

/** The issue as webhook payloads and the REST API describe it. */
export const issueResourceSelect = {
  id: true,
  number: true,
  title: true,
  description: true,
  type: true,
  priority: true,
  estimate: true,
  dueDate: true,
  startDate: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  project: { select: { id: true, key: true, name: true } },
  status: { select: { id: true, name: true, category: true } },
  assignee: { select: { id: true, name: true, email: true } },
  reporter: { select: { id: true, name: true, email: true } },
  sprint: { select: { id: true, name: true } },
  release: { select: { id: true, name: true } },
  parent: { select: { number: true, project: { select: { key: true } } } },
  resolution: { select: { name: true } },
  customType: { select: { name: true } },
  labels: { select: { label: { select: { name: true } } } },
  workspace: { select: { slug: true } },
} satisfies Prisma.IssueSelect;

type IssueResourceRow = Prisma.IssueGetPayload<{ select: typeof issueResourceSelect }>;

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export function toIssueResource(issue: IssueResourceRow) {
  const key = formatIssueKey(issue.project.key, issue.number);
  return {
    id: issue.id,
    key,
    url: `${env.NEXT_PUBLIC_APP_URL}/${issue.workspace.slug}/issues/${key}`,
    title: issue.title,
    description: issue.description,
    type: issue.customType?.name ?? issue.type,
    baseType: issue.type,
    priority: issue.priority,
    status: issue.status,
    resolution: issue.resolution?.name ?? null,
    estimate: issue.estimate,
    startDate: day(issue.startDate),
    dueDate: day(issue.dueDate),
    project: issue.project,
    assignee: issue.assignee,
    reporter: issue.reporter,
    sprint: issue.sprint,
    release: issue.release,
    parent: issue.parent ? formatIssueKey(issue.parent.project.key, issue.parent.number) : null,
    labels: issue.labels.map((l) => l.label.name),
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt.toISOString(),
    resolvedAt: issue.resolvedAt?.toISOString() ?? null,
  };
}

export type IssueResource = ReturnType<typeof toIssueResource>;

/** Enqueues an issue event with the issue's current state (read inside the transaction). */
export async function enqueueIssueEvent(
  tx: Tx,
  workspaceId: string,
  event: "issue.created" | "issue.updated",
  issueId: string,
  extra: Record<string, unknown> = {},
) {
  const hooks = await tx.webhook.count({
    where: { workspaceId, active: true, events: { has: event } },
  });
  if (!hooks) return;
  const issue = await tx.issue.findUniqueOrThrow({
    where: { id: issueId },
    select: issueResourceSelect,
  });
  await enqueueWebhooks(tx, workspaceId, event, { issue: toIssueResource(issue), ...extra });
}
