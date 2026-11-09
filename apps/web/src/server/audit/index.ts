import "server-only";
import { type db, type Prisma } from "@tracklane/db";
import { headers } from "next/headers";
import { clientIp } from "@/server/rate-limit";
import type { AuditAction } from "@tracklane/core";

type Client = Prisma.TransactionClient | typeof db;

export interface AuditInput {
  workspaceId: string;
  actor: { id: string; name: string } | { id: string } | null;
  action: AuditAction;
  target?: { type: string; id: string; label?: string | null };
  metadata?: Record<string, unknown>;
}

/** IP and user agent of the current request, if there is one. */
async function requestInfo() {
  try {
    const h = await headers();
    return { ipAddress: clientIp(h), userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
  } catch {
    return { ipAddress: null, userAgent: null }; // outside a request (jobs, scripts)
  }
}

/**
 * Records an audit event. Pass the transaction client so the entry commits (or rolls back)
 * with the change it describes.
 */
export async function audit(client: Client, input: AuditInput) {
  let actorName = "System";
  if (input.actor) {
    actorName =
      "name" in input.actor
        ? input.actor.name
        : ((await client.user.findUnique({ where: { id: input.actor.id }, select: { name: true } }))
            ?.name ?? "Unknown user");
  }
  await client.auditEvent.create({
    data: {
      workspaceId: input.workspaceId,
      actorId: input.actor?.id ?? null,
      actorName,
      action: input.action,
      targetType: input.target?.type ?? null,
      targetId: input.target?.id ?? null,
      targetLabel: input.target?.label ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      ...(await requestInfo()),
    },
  });
}
