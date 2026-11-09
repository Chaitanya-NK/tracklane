import "server-only";
import { AppError } from "@tracklane/core";
import { db } from "@tracklane/db";
import { assertWorkspacePermission } from "@/server/authz";

export const COMPONENT_STATUSES = [
  "operational",
  "degraded",
  "partial_outage",
  "major_outage",
  "maintenance",
] as const;
export const INCIDENT_STATUSES = ["investigating", "identified", "monitoring", "resolved"] as const;
export const INCIDENT_IMPACTS = ["minor", "major", "critical", "maintenance"] as const;
export type ComponentStatus = (typeof COMPONENT_STATUSES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export type IncidentImpact = (typeof INCIDENT_IMPACTS)[number];

const admin = (workspaceId: string, userId: string) =>
  assertWorkspacePermission(workspaceId, userId, "workspace:update");

export async function getStatusAdmin(workspaceId: string) {
  const [workspace, components, incidents] = await Promise.all([
    db.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { statusPagePublic: true, slug: true },
    }),
    db.statusComponent.findMany({
      where: { workspaceId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, description: true, status: true },
    }),
    db.incident.findMany({
      where: { workspaceId },
      orderBy: [{ resolvedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
      take: 25,
      select: {
        id: true,
        title: true,
        impact: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        components: { select: { componentId: true } },
        updates: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            body: true,
            createdAt: true,
            author: { select: { name: true } },
          },
        },
      },
    }),
  ]);
  return { ...workspace, components, incidents };
}

export type StatusAdmin = Awaited<ReturnType<typeof getStatusAdmin>>;

export async function setStatusPagePublic(workspaceId: string, userId: string, value: boolean) {
  await admin(workspaceId, userId);
  await db.workspace.update({ where: { id: workspaceId }, data: { statusPagePublic: value } });
}

export async function saveComponent(
  workspaceId: string,
  userId: string,
  id: string | null,
  input: { name: string; description: string; status: ComponentStatus },
) {
  await admin(workspaceId, userId);
  if (id) {
    const { count } = await db.statusComponent.updateMany({
      where: { id, workspaceId },
      data: input,
    });
    if (!count) throw new AppError("not_found", "Component not found");
    return;
  }
  const count = await db.statusComponent.count({ where: { workspaceId } });
  if (count >= 30) throw new AppError("conflict", "A status page can list at most 30 components");
  await db.statusComponent.create({ data: { ...input, workspaceId, position: count } });
}

export async function deleteComponent(workspaceId: string, userId: string, id: string) {
  await admin(workspaceId, userId);
  const { count } = await db.statusComponent.deleteMany({ where: { id, workspaceId } });
  if (!count) throw new AppError("not_found", "Component not found");
}

/** Opens an incident with its first update; affected components take `componentStatus`. */
export async function createIncident(
  workspaceId: string,
  userId: string,
  input: {
    title: string;
    impact: IncidentImpact;
    status: IncidentStatus;
    body: string;
    componentIds: string[];
    componentStatus: ComponentStatus;
  },
) {
  await admin(workspaceId, userId);
  const components = await db.statusComponent.findMany({
    where: { id: { in: input.componentIds }, workspaceId },
    select: { id: true },
  });
  return db.$transaction(async (tx) => {
    const resolved = input.status === "resolved";
    const incident = await tx.incident.create({
      data: {
        workspaceId,
        title: input.title,
        impact: input.impact,
        status: input.status,
        createdById: userId,
        resolvedAt: resolved ? new Date() : null,
        updates: { create: { status: input.status, body: input.body, authorId: userId } },
        components: { create: components.map((c) => ({ componentId: c.id })) },
      },
      select: { id: true },
    });
    if (components.length && !resolved) {
      await tx.statusComponent.updateMany({
        where: { id: { in: components.map((c) => c.id) } },
        data: { status: input.componentStatus },
      });
    }
    return incident;
  });
}

/** Posts an update. Resolving sets the affected components back to operational. */
export async function addIncidentUpdate(
  workspaceId: string,
  userId: string,
  incidentId: string,
  input: { status: IncidentStatus; body: string },
) {
  await admin(workspaceId, userId);
  const incident = await db.incident.findFirst({
    where: { id: incidentId, workspaceId },
    select: { resolvedAt: true, components: { select: { componentId: true } } },
  });
  if (!incident) throw new AppError("not_found", "Incident not found");
  await db.$transaction(async (tx) => {
    await tx.incidentUpdate.create({
      data: { incidentId, status: input.status, body: input.body, authorId: userId },
    });
    const resolved = input.status === "resolved";
    await tx.incident.update({
      where: { id: incidentId },
      data: {
        status: input.status,
        resolvedAt: resolved ? (incident.resolvedAt ?? new Date()) : null,
      },
    });
    if (resolved && incident.components.length) {
      // Only components no other open incident still affects.
      const stillAffected = await tx.incidentComponent.findMany({
        where: {
          componentId: { in: incident.components.map((c) => c.componentId) },
          incident: { resolvedAt: null, id: { not: incidentId } },
        },
        select: { componentId: true },
      });
      const busy = new Set(stillAffected.map((c) => c.componentId));
      await tx.statusComponent.updateMany({
        where: {
          id: { in: incident.components.map((c) => c.componentId).filter((id) => !busy.has(id)) },
        },
        data: { status: "operational" },
      });
    }
  });
}

export async function deleteIncident(workspaceId: string, userId: string, incidentId: string) {
  await admin(workspaceId, userId);
  const { count } = await db.incident.deleteMany({ where: { id: incidentId, workspaceId } });
  if (!count) throw new AppError("not_found", "Incident not found");
}

const DAY = 86_400_000;
const IMPACT_RANK: Record<IncidentImpact, number> = {
  maintenance: 1,
  minor: 2,
  major: 3,
  critical: 4,
};

/**
 * The public status page: components, open incidents, the last 14 days of incidents, and a
 * 30-day history bar per component (the worst incident impact each day).
 */
export async function getPublicStatus(workspaceSlug: string, now = new Date()) {
  const workspace = await db.workspace.findFirst({
    where: { slug: workspaceSlug, statusPagePublic: true },
    select: { id: true, name: true },
  });
  if (!workspace) return null;
  const since = new Date(now.getTime() - 30 * DAY);
  const [components, incidents] = await Promise.all([
    db.statusComponent.findMany({
      where: { workspaceId: workspace.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, description: true, status: true },
    }),
    db.incident.findMany({
      where: {
        workspaceId: workspace.id,
        OR: [{ resolvedAt: null }, { resolvedAt: { gte: since } }],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        impact: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        components: { select: { componentId: true, component: { select: { name: true } } } },
        updates: {
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true, body: true, createdAt: true },
        },
      },
    }),
  ]);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const history = components.map((c) => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const start = today - (29 - i) * DAY;
      const end = start + DAY;
      let worst: IncidentImpact | null = null;
      for (const inc of incidents) {
        if (!inc.components.some((x) => x.componentId === c.id)) continue;
        const from = inc.createdAt.getTime();
        const to = (inc.resolvedAt ?? now).getTime();
        if (from < end && to >= start && (!worst || IMPACT_RANK[inc.impact] > IMPACT_RANK[worst]))
          worst = inc.impact;
      }
      return { date: new Date(start).toISOString().slice(0, 10), worst };
    });
    const clean = days.filter((d) => !d.worst || d.worst === "maintenance").length;
    return { componentId: c.id, days, uptime: Math.round((clean / days.length) * 1000) / 10 };
  });
  return {
    workspace,
    components,
    history,
    open: incidents.filter((i) => !i.resolvedAt),
    past: incidents.filter(
      (i) => i.resolvedAt && i.resolvedAt.getTime() >= now.getTime() - 14 * DAY,
    ),
  };
}
