import "server-only";
import { rateLimit } from "@/server/rate-limit";
import { audit } from "@/server/audit";
import { randomBytes } from "node:crypto";
import { AppError, formatIssueKey } from "@tracklane/core";
import { db } from "@tracklane/db";
import { createIssue } from "@/features/issues/server/service";
import { assertWorkspacePermission } from "@/server/authz";

// ── Settings ────────────────────────────────────────────────────────────────

export async function setProjectPublicPages(
  workspaceId: string,
  userId: string,
  projectId: string,
  input: { portalEnabled: boolean; roadmapPublic: boolean },
) {
  await assertWorkspacePermission(workspaceId, userId, "projects:update");
  const { count } = await db.project.updateMany({
    where: { id: projectId, workspaceId },
    data: input,
  });
  if (!count) throw new AppError("not_found", "Project not found");
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { key: true, name: true },
  });
  await audit(db, {
    workspaceId: workspaceId,
    actor: { id: userId },
    action: "project.public_pages_changed",
    target: {
      type: "project",
      id: projectId,
      label: project && `${project.key} · ${project.name}`,
    },
    metadata: input,
  });
}

// ── Request portal ──────────────────────────────────────────────────────────

/** A project whose portal is switched on, looked up by its public URL. */
export async function getPortal(workspaceSlug: string, projectKey: string) {
  return db.project.findFirst({
    where: {
      key: projectKey.toUpperCase(),
      portalEnabled: true,
      archivedAt: null,
      workspace: { slug: workspaceSlug },
    },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      workspaceId: true,
      leadId: true,
      createdById: true,
      workspace: { select: { name: true, slug: true } },
    },
  });
}

/** At most 5 requests per sender (IP) per 10 minutes, per server instance. */
function portalRateLimit(sender: string) {
  rateLimit("portal", sender, { limit: 5, windowMs: 10 * 60_000 });
}

/**
 * Files a portal request as an issue, created on behalf of the project lead (who must be a
 * member). The requester gets a private tracking link.
 */
export async function submitPortalRequest(input: {
  workspaceSlug: string;
  projectKey: string;
  sender: string;
  name: string;
  email: string;
  kind: "bug" | "story";
  title: string;
  description: string;
}) {
  portalRateLimit(input.sender);
  const portal = await getPortal(input.workspaceSlug, input.projectKey);
  if (!portal) throw new AppError("not_found", "This portal isn't available");
  // Who files it: the lead, else the project's creator, else the oldest owner.
  const candidates = [portal.leadId, portal.createdById].filter((id): id is string => Boolean(id));
  const members = await db.workspaceMember.findMany({
    where: {
      workspaceId: portal.workspaceId,
      OR: [{ userId: { in: candidates } }, { role: "owner" }],
    },
    orderBy: { createdAt: "asc" },
    select: { userId: true, role: true },
  });
  const filer =
    candidates.map((id) => members.find((m) => m.userId === id)).find(Boolean) ??
    members.find((m) => m.role === "owner");
  if (!filer) throw new AppError("conflict", "This portal can't take requests right now");
  const description = [
    input.description.trim(),
    "",
    `---`,
    `_Submitted through the request portal by ${input.name} (${input.email})._`,
  ].join("\n");
  const issue = await createIssue({
    workspaceId: portal.workspaceId,
    projectId: portal.id,
    userId: filer.userId,
    title: input.title,
    description,
    type: input.kind,
    priority: "medium",
  });
  const token = randomBytes(18).toString("base64url");
  await db.portalRequest.create({
    data: {
      projectId: portal.id,
      issueId: issue.id,
      name: input.name,
      email: input.email.toLowerCase(),
      token,
    },
  });
  return { key: issue.key, token };
}

/** What the requester sees on their tracking page: status, and nothing internal. */
export async function getPortalRequest(workspaceSlug: string, projectKey: string, token: string) {
  const request = await db.portalRequest.findFirst({
    where: {
      token,
      project: { key: projectKey.toUpperCase(), workspace: { slug: workspaceSlug } },
    },
    select: {
      name: true,
      createdAt: true,
      project: { select: { name: true, key: true, workspace: { select: { name: true } } } },
      issue: {
        select: {
          number: true,
          title: true,
          type: true,
          updatedAt: true,
          resolvedAt: true,
          status: { select: { name: true, category: true } },
          resolution: { select: { name: true } },
        },
      },
    },
  });
  if (!request) return null;
  return {
    ...request,
    key: formatIssueKey(request.project.key, request.issue.number),
  };
}

// ── Public roadmap ──────────────────────────────────────────────────────────

/**
 * Epics grouped Now / Next / Later (in progress, to do with a start date or in a sprint, the
 * rest) plus shipped ones, and upcoming releases. Only titles and progress are public.
 */
export async function getPublicRoadmap(workspaceSlug: string, projectKey: string) {
  const project = await db.project.findFirst({
    where: {
      key: projectKey.toUpperCase(),
      roadmapPublic: true,
      archivedAt: null,
      workspace: { slug: workspaceSlug },
    },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      workspace: { select: { name: true } },
    },
  });
  if (!project) return null;
  const [epics, releases] = await Promise.all([
    db.issue.findMany({
      where: { projectId: project.id, type: "epic" },
      orderBy: [{ position: "asc" }],
      select: {
        id: true,
        title: true,
        startDate: true,
        dueDate: true,
        resolvedAt: true,
        status: { select: { category: true } },
        children: { select: { status: { select: { category: true } } } },
      },
    }),
    db.release.findMany({
      where: { projectId: project.id, status: { not: "archived" } },
      orderBy: [{ status: "asc" }, { releaseDate: { sort: "asc", nulls: "last" } }],
      take: 8,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        releaseDate: true,
        releasedAt: true,
      },
    }),
  ]);
  const cards = epics.map((e) => ({
    id: e.id,
    title: e.title,
    dueDate: e.dueDate?.toISOString().slice(0, 10) ?? null,
    resolvedAt: e.resolvedAt,
    done: e.children.filter((c) => c.status.category === "done").length,
    total: e.children.length,
    category: e.status.category,
    started: Boolean(e.startDate),
  }));
  return {
    project,
    columns: {
      now: cards.filter((c) => c.category === "in_progress"),
      next: cards.filter((c) => c.category === "todo" && (c.started || c.dueDate)),
      later: cards.filter((c) => c.category === "todo" && !c.started && !c.dueDate),
      shipped: cards
        .filter((c) => c.category === "done")
        .sort((a, b) => +(b.resolvedAt ?? 0) - +(a.resolvedAt ?? 0))
        .slice(0, 6),
    },
    releases: releases.map((r) => ({
      ...r,
      releaseDate: r.releaseDate?.toISOString().slice(0, 10) ?? null,
    })),
  };
}
