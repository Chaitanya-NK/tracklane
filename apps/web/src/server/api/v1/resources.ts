import "server-only";
import { AppError, ISSUE_TYPES, PRIORITIES, parseIssueKey } from "@tracklane/core";
import { db } from "@tracklane/db";
import { after } from "next/server";
import { z } from "zod";
import {
  createIssue,
  updateIssue,
  addComment,
  deleteIssue,
} from "@/features/issues/server/service";
import { searchIssues } from "@/features/search/server/search";
import { storage } from "@/server/storage";
import { issueResourceSelect, toIssueResource } from "@/server/webhooks/enqueue";
import type { ApiContext } from "../http";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

/** Resolves an issue key in the token's workspace. */
export async function issueByKey(ctx: ApiContext, key: string) {
  const parsed = parseIssueKey(key);
  if (!parsed) throw new AppError("not_found", `${key} isn't an issue key`);
  const issue = await db.issue.findFirst({
    where: {
      workspaceId: ctx.workspace.id,
      number: parsed.number,
      project: { key: parsed.projectKey },
    },
    select: { id: true, projectId: true, project: { select: { key: true } } },
  });
  if (!issue) throw new AppError("not_found", `${key.toUpperCase()} not found`);
  return issue;
}

export async function getIssueResource(issueId: string) {
  return toIssueResource(
    await db.issue.findUniqueOrThrow({ where: { id: issueId }, select: issueResourceSelect }),
  );
}

async function userIdByEmail(ctx: ApiContext, email: string | null | undefined) {
  if (email === undefined) return undefined;
  if (email === null) return null;
  const member = await db.workspaceMember.findFirst({
    where: { workspaceId: ctx.workspace.id, user: { email: email.toLowerCase() } },
    select: { userId: true },
  });
  if (!member)
    throw new AppError("validation_failed", `${email} isn't in this workspace`, {
      field: "assignee",
    });
  return member.userId;
}

async function labelIds(projectId: string, names: string[] | undefined) {
  if (!names) return undefined;
  const labels = await db.label.findMany({
    where: { projectId, name: { in: names, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  const missing = names.filter(
    (n) => !labels.some((l) => l.name.toLowerCase() === n.toLowerCase()),
  );
  if (missing.length)
    throw new AppError("validation_failed", `Unknown labels: ${missing.join(", ")}`, {
      field: "labels",
    });
  return labels.map((l) => l.id);
}

async function statusIdByName(projectId: string, name: string | undefined) {
  if (name === undefined) return undefined;
  const status = await db.workflowStatus.findFirst({
    where: { projectId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (!status)
    throw new AppError("validation_failed", `There's no status called ${name}`, {
      field: "status",
    });
  return status.id;
}

async function parentId(ctx: ApiContext, key: string | null | undefined) {
  if (key === undefined) return undefined;
  if (key === null) return null;
  return (await issueByKey(ctx, key)).id;
}

export const createIssueSchema = z.object({
  project: z.string().min(1).describe("Project key"),
  title: z.string().trim().min(1).max(255),
  type: z.enum(ISSUE_TYPES).default("task"),
  priority: z.enum(PRIORITIES).default("medium"),
  description: z.string().max(100_000).optional(),
  status: z.string().optional(),
  assignee: z.string().email().nullable().optional(),
  parent: z.string().nullable().optional(),
  labels: z.array(z.string()).max(20).optional(),
  estimate: z.number().int().min(0).max(1000).nullable().optional(),
  startDate: date.nullable().optional(),
  dueDate: date.nullable().optional(),
});

export async function apiCreateIssue(ctx: ApiContext, input: z.infer<typeof createIssueSchema>) {
  const project = await db.project.findFirst({
    where: { workspaceId: ctx.workspace.id, key: input.project.toUpperCase(), archivedAt: null },
    select: { id: true },
  });
  if (!project)
    throw new AppError("validation_failed", `There's no project ${input.project}`, {
      field: "project",
    });
  const created = await createIssue({
    workspaceId: ctx.workspace.id,
    projectId: project.id,
    userId: ctx.user.id,
    title: input.title,
    type: input.type,
    priority: input.priority,
    description: input.description,
    statusId: await statusIdByName(project.id, input.status),
    assigneeId: await userIdByEmail(ctx, input.assignee),
    parentId: await parentId(ctx, input.parent),
    labelIds: await labelIds(project.id, input.labels),
    estimate: input.estimate,
    startDate: input.startDate,
    dueDate: input.dueDate,
  });
  return getIssueResource(created.id);
}

export const updateIssueSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    description: z.string().max(100_000),
    type: z.enum(ISSUE_TYPES),
    priority: z.enum(PRIORITIES),
    status: z.string(),
    assignee: z.string().email().nullable(),
    parent: z.string().nullable(),
    labels: z.array(z.string()).max(20),
    estimate: z.number().int().min(0).max(1000).nullable(),
    startDate: date.nullable(),
    dueDate: date.nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Send at least one field to change");

export async function apiUpdateIssue(
  ctx: ApiContext,
  key: string,
  input: z.infer<typeof updateIssueSchema>,
) {
  const issue = await issueByKey(ctx, key);
  const result = await updateIssue({
    issueId: issue.id,
    userId: ctx.user.id,
    patch: {
      title: input.title,
      description: input.description,
      type: input.type,
      priority: input.priority,
      statusId: await statusIdByName(issue.projectId, input.status),
      assigneeId: await userIdByEmail(ctx, input.assignee),
      parentId: await parentId(ctx, input.parent),
      labelIds: await labelIds(issue.projectId, input.labels),
      estimate: input.estimate,
      startDate: input.startDate,
      dueDate: input.dueDate,
    },
  });
  return {
    issue: await getIssueResource(issue.id),
    approvalRequested: result.approval?.toStatus ?? null,
  };
}

export async function apiDeleteIssue(ctx: ApiContext, key: string) {
  const issue = await issueByKey(ctx, key);
  const { storageKeys } = await deleteIssue({ issueId: issue.id, userId: ctx.user.id });
  after(() => Promise.all(storageKeys.map((k) => storage().delete(k))));
}

export async function apiSearchIssues(ctx: ApiContext, url: URL) {
  const query = url.searchParams.get("q") ?? "ORDER BY updated DESC";
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get("perPage")) || 50));
  const result = await searchIssues({
    workspaceId: ctx.workspace.id,
    userId: ctx.user.id,
    query,
    page,
    pageSize: perPage,
  });
  if (!result.ok)
    throw new AppError("validation_failed", `TQL: ${result.error.message}`, { field: "q" });
  const rows = await db.issue.findMany({
    where: { id: { in: result.issues.map((i) => i.id) } },
    select: issueResourceSelect,
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return {
    data: result.issues.map((i) => toIssueResource(byId.get(i.id)!)),
    meta: { page, perPage, total: result.total, hasMore: page * perPage < result.total },
  };
}

export async function apiListComments(ctx: ApiContext, key: string) {
  const issue = await issueByKey(ctx, key);
  const comments = await db.comment.findMany({
    where: { issueId: issue.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      createdAt: true,
      editedAt: true,
      author: { select: { id: true, name: true, email: true } },
    },
  });
  return comments.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    editedAt: c.editedAt?.toISOString() ?? null,
  }));
}

export const createCommentSchema = z.object({ body: z.string().trim().min(1).max(20_000) });

export async function apiAddComment(ctx: ApiContext, key: string, body: string) {
  const issue = await issueByKey(ctx, key);
  const comment = await addComment({ issueId: issue.id, userId: ctx.user.id, body });
  return { id: comment.id, body, author: ctx.user, createdAt: new Date().toISOString() };
}

export async function apiListProjects(ctx: ApiContext) {
  const projects = await db.project.findMany({
    where: { workspaceId: ctx.workspace.id, archivedAt: null },
    orderBy: { key: "asc" },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      type: true,
      lead: { select: { id: true, name: true, email: true } },
      statuses: { orderBy: { position: "asc" }, select: { id: true, name: true, category: true } },
      labels: { orderBy: { name: "asc" }, select: { name: true } },
    },
  });
  return projects.map((p) => ({ ...p, labels: p.labels.map((l) => l.name) }));
}
