import "server-only";
import { parseTql, type TqlCatalog } from "@tracklane/core";
import { db, type Prisma } from "@tracklane/db";
import { issueListSelect } from "@/features/issues/server";
import { compileTql } from "../compile";
import { loadTqlEnvironment } from "./environment";

export const searchSelect = {
  ...issueListSelect,
  reporter: { select: { id: true, name: true } },
  sprint: { select: { name: true } },
  resolvedAt: true,
  startDate: true,
} satisfies Prisma.IssueSelect;

export type SearchRow = Prisma.IssueGetPayload<{ select: typeof searchSelect }>;

export type SearchResult =
  | { ok: true; issues: SearchRow[]; total: number }
  | { ok: false; error: { message: string; position?: number; end?: number } };

export const PAGE_SIZE = 50;

/** Runs a TQL query in a workspace. Parse/compile problems come back as errors, not throws. */
export async function searchIssues(input: {
  workspaceId: string;
  userId: string;
  query: string;
  page?: number;
  pageSize?: number;
}): Promise<SearchResult> {
  const env = await loadTqlEnvironment(input.workspaceId, input.userId);
  const parsed = parseTql(input.query, env.parseOptions);
  if (!parsed.ok) {
    return {
      ok: false,
      error: {
        message: parsed.error.message,
        position: parsed.error.position,
        end: parsed.error.end,
      },
    };
  }
  const compiled = compileTql(parsed.query, {
    workspaceId: input.workspaceId,
    userId: input.userId,
    now: new Date(),
    ...env.compile,
  });
  if (!compiled.ok) return { ok: false, error: { message: compiled.message } };

  const pageSize = input.pageSize ?? PAGE_SIZE;
  const [issues, total] = await Promise.all([
    db.issue.findMany({
      where: compiled.where,
      orderBy: compiled.orderBy,
      skip: Math.max(0, (input.page ?? 1) - 1) * pageSize,
      take: pageSize,
      select: searchSelect,
    }),
    db.issue.count({ where: compiled.where }),
  ]);
  return { ok: true, issues, total };
}

/** A TQL query as a Prisma filter for the user (dashboards, reports). */
export async function tqlWhere(input: { workspaceId: string; userId: string; query: string }) {
  const env = await loadTqlEnvironment(input.workspaceId, input.userId);
  const parsed = parseTql(input.query, env.parseOptions);
  if (!parsed.ok) return { ok: false as const, message: parsed.error.message };
  const compiled = compileTql(parsed.query, {
    workspaceId: input.workspaceId,
    userId: input.userId,
    now: new Date(),
    ...env.compile,
  });
  if (!compiled.ok) return { ok: false as const, message: compiled.message };
  return { ok: true as const, where: compiled.where, orderBy: compiled.orderBy };
}

/** Real values in the workspace, for TQL autocomplete. */
export async function getTqlCatalog(workspaceId: string, userId: string): Promise<TqlCatalog> {
  const [projects, statuses, members, labels, sprints, resolutions, env] = await Promise.all([
    db.project.findMany({
      where: { workspaceId, archivedAt: null },
      orderBy: { key: "asc" },
      select: { key: true, name: true },
    }),
    db.workflowStatus.findMany({
      where: { project: { workspaceId } },
      distinct: ["name"],
      orderBy: { position: "asc" },
      select: { name: true },
    }),
    db.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: { user: { name: "asc" } },
      select: { user: { select: { name: true, email: true } } },
    }),
    db.label.findMany({
      where: { project: { workspaceId } },
      distinct: ["name"],
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    db.sprint.findMany({
      where: { project: { workspaceId } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { name: true },
    }),
    db.resolution.findMany({
      where: { workspaceId },
      orderBy: { position: "asc" },
      select: { name: true },
    }),
    loadTqlEnvironment(workspaceId, userId),
  ]);
  return {
    customFields: [...(env.parseOptions.customFields ?? [])],
    functions: [...(env.parseOptions.functions ?? [])],
    savedFilters: env.savedFilterNames,
    projects,
    statuses: statuses.map((s) => s.name),
    users: members.map((m) => m.user),
    labels: labels.map((l) => l.name),
    sprints: sprints.map((s) => s.name),
    resolutions: resolutions.map((r) => r.name),
  };
}
