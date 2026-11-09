import "server-only";
import { db, type Prisma } from "@tracklane/db";
import { actionsInCategory, AUDIT_CATEGORIES, type AuditCategory } from "@tracklane/core";
import { assertWorkspacePermission } from "@/server/authz";

export interface AuditFilters {
  category?: AuditCategory;
  actorId?: string;
  q?: string;
  from?: Date;
  to?: Date;
}

export function parseAuditFilters(params: Record<string, string | string[] | undefined>) {
  const one = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : undefined);
  const date = (v?: string) => {
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
    const d = new Date(`${v}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };
  const category = one("category");
  const to = date(one("to"));
  return {
    category: AUDIT_CATEGORIES.includes(category as AuditCategory)
      ? (category as AuditCategory)
      : undefined,
    actorId: one("actor") || undefined,
    q: one("q")?.trim().slice(0, 100) || undefined,
    from: date(one("from")),
    // Inclusive end date.
    to: to ? new Date(to.getTime() + 86_400_000) : undefined,
  } satisfies AuditFilters;
}

function where(workspaceId: string, f: AuditFilters): Prisma.AuditEventWhereInput {
  return {
    workspaceId,
    ...(f.category ? { action: { in: actionsInCategory(f.category) } } : {}),
    ...(f.actorId ? { actorId: f.actorId } : {}),
    ...(f.q
      ? {
          OR: [
            { targetLabel: { contains: f.q, mode: "insensitive" } },
            { actorName: { contains: f.q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(f.from || f.to
      ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } }
      : {}),
  };
}

const PAGE = 50;

/** One page of audit events, newest first. `cursor` is the last event id of the previous page. */
export async function listAuditEvents(input: {
  workspaceId: string;
  userId: string;
  filters: AuditFilters;
  cursor?: string;
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "workspace:update");
  const rows = await db.auditEvent.findMany({
    where: where(input.workspaceId, input.filters),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      action: true,
      actorId: true,
      actorName: true,
      targetType: true,
      targetLabel: true,
      metadata: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
    },
  });
  return {
    events: rows.slice(0, PAGE),
    nextCursor: rows.length > PAGE ? rows[PAGE - 1]!.id : null,
  };
}

export type AuditEventRow = Awaited<ReturnType<typeof listAuditEvents>>["events"][number];

/** Everyone who appears in the log, for the actor filter. */
export async function listAuditActors(workspaceId: string) {
  const rows = await db.auditEvent.findMany({
    where: { workspaceId, actorId: { not: null } },
    distinct: ["actorId"],
    select: { actorId: true, actorName: true },
    take: 200,
  });
  return rows.map((r) => ({ id: r.actorId!, name: r.actorName }));
}

/** All matching events (capped) for CSV export. */
export async function exportAuditEvents(input: {
  workspaceId: string;
  userId: string;
  filters: AuditFilters;
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "workspace:update");
  return db.auditEvent.findMany({
    where: where(input.workspaceId, input.filters),
    orderBy: { createdAt: "desc" },
    take: 10_000,
  });
}
