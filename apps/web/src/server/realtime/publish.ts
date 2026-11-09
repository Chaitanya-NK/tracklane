import "server-only";
import type { Prisma } from "@tracklane/db";

/** Channel the realtime server LISTENs on. Keep in sync with apps/realtime. */
export const REALTIME_CHANNEL = "tracklane_events";

/**
 * Room names. Everything is scoped by workspace so a token for one workspace can't join
 * another's rooms.
 */
export const rooms = {
  user: (userId: string) => `user:${userId}`,
  project: (workspaceId: string, projectId: string) => `ws:${workspaceId}:project:${projectId}`,
  issue: (workspaceId: string, issueId: string) => `ws:${workspaceId}:issue:${issueId}`,
  /** Docs, whiteboards, retros and poker sessions: one room per item. */
  item: (workspaceId: string, kind: "doc" | "whiteboard" | "retro" | "poker", id: string) =>
    `ws:${workspaceId}:${kind}:${id}`,
};

export interface RealtimeEvent {
  rooms: string[];
  event: "issue:changed" | "notification:new" | "room:changed";
  data: Record<string, string | number | boolean | null>;
}

/**
 * Publishes an event through Postgres NOTIFY. Inside a transaction it's only delivered when the
 * transaction commits, so clients never refresh to see a change that was rolled back.
 * Payloads stay tiny (ids and short text): NOTIFY caps them at 8 KB.
 */
export async function publish(tx: Prisma.TransactionClient, event: RealtimeEvent) {
  const payload = JSON.stringify(event);
  if (payload.length > 7000) return;
  await tx.$executeRaw`select pg_notify(${REALTIME_CHANNEL}, ${payload})`;
}

/** Tells everyone else in an item's room to re-fetch (retros, poker, docs). */
export function publishRoomChanged(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  kind: "doc" | "whiteboard" | "retro" | "poker",
  id: string,
  actorId: string,
) {
  return publish(tx, {
    rooms: [rooms.item(workspaceId, kind, id)],
    event: "room:changed",
    data: { actorId },
  });
}
