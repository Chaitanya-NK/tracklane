import "server-only";
import { audit } from "@/server/audit";
import { randomBytes } from "node:crypto";
import {
  AppError,
  ISSUE_TYPES,
  type IssueType,
  type Priority,
  PRIORITIES,
  parseCsv,
  WEBHOOK_EVENTS,
} from "@tracklane/core";
import { db } from "@tracklane/db";
import { env } from "@/env";
import { createIssue } from "@/features/issues/server/service";
import { assertWorkspacePermission } from "@/server/authz";
import type { GitHubConfig } from "./github";

const SLACK_URL = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/;

/** Both integrations' state for the settings page (secrets omitted). */
export async function getIntegrations(workspaceId: string) {
  const [github, slack] = await Promise.all([
    db.integration.findUnique({
      where: { workspaceId_kind: { workspaceId, kind: "github" } },
      select: { config: true, enabled: true, createdAt: true },
    }),
    db.webhook.findFirst({
      where: { workspaceId, format: "slack" },
      select: { id: true, url: true, events: true, active: true, failureCount: true },
    }),
  ]);
  const githubConfig = github?.config as Partial<GitHubConfig> | undefined;
  return {
    github: github
      ? {
          repo: githubConfig?.repo ?? "",
          autoTransition: githubConfig?.autoTransition ?? true,
          smartCommits: githubConfig?.smartCommits ?? true,
          enabled: github.enabled,
          webhookUrl: `${env.NEXT_PUBLIC_APP_URL}/api/integrations/github/${workspaceId}`,
        }
      : null,
    slack: slack ? { ...slack, url: `${slack.url.slice(0, 40)}…` } : null,
  };
}

/** Connects (or reconfigures) GitHub. Returns the webhook secret when it is new. */
export async function saveGitHub(input: {
  workspaceId: string;
  userId: string;
  repo: string;
  autoTransition: boolean;
  smartCommits: boolean;
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "workspace:update");
  const repo = input.repo
    .trim()
    .replace(/^https:\/\/github\.com\//, "")
    .replace(/\.git$/, "");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new AppError("validation_failed", "Use owner/repository, e.g. acme/web", {
      field: "repo",
    });
  }
  const config: GitHubConfig = {
    repo,
    autoTransition: input.autoTransition,
    smartCommits: input.smartCommits,
    actorId: input.userId,
  };
  const existing = await db.integration.findUnique({
    where: { workspaceId_kind: { workspaceId: input.workspaceId, kind: "github" } },
    select: { id: true },
  });
  if (existing) {
    await db.integration.update({
      where: { id: existing.id },
      data: { config: { ...config }, enabled: true },
    });
    await audit(db, {
      workspaceId: input.workspaceId,
      actor: { id: input.userId },
      action: "integration.updated",
      target: { type: "integration", id: existing.id, label: `GitHub ${repo}` },
      metadata: { autoTransition: input.autoTransition, smartCommits: input.smartCommits },
    });
    return { secret: null };
  }
  const secret = randomBytes(24).toString("base64url");
  const created = await db.integration.create({
    data: { workspaceId: input.workspaceId, kind: "github", config: { ...config }, secret },
    select: { id: true },
  });
  await audit(db, {
    workspaceId: input.workspaceId,
    actor: { id: input.userId },
    action: "integration.connected",
    target: { type: "integration", id: created.id, label: `GitHub ${repo}` },
  });
  return { secret };
}

export async function disconnect(input: {
  workspaceId: string;
  userId: string;
  kind: "github" | "slack";
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "workspace:update");
  if (input.kind === "github") {
    await db.integration.deleteMany({ where: { workspaceId: input.workspaceId, kind: "github" } });
  } else {
    await db.webhook.deleteMany({ where: { workspaceId: input.workspaceId, format: "slack" } });
  }
  await audit(db, {
    workspaceId: input.workspaceId,
    actor: { id: input.userId },
    action: "integration.disconnected",
    target: {
      type: "integration",
      id: input.kind,
      label: input.kind === "github" ? "GitHub" : "Slack",
    },
  });
}

/** Posts chosen events to a Slack channel through an incoming webhook. */
export async function saveSlack(input: {
  workspaceId: string;
  userId: string;
  url: string | null;
  events: string[];
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "workspace:update");
  const events = input.events.filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e));
  if (!events.length) throw new AppError("validation_failed", "Pick at least one event");
  const existing = await db.webhook.findFirst({
    where: { workspaceId: input.workspaceId, format: "slack" },
    select: { id: true },
  });
  if (input.url !== null && !SLACK_URL.test(input.url.trim())) {
    throw new AppError(
      "validation_failed",
      "Paste a Slack incoming webhook URL (https://hooks.slack.com/services/…)",
      {
        field: "url",
      },
    );
  }
  if (existing) {
    await db.webhook.update({
      where: { id: existing.id },
      data: {
        events,
        active: true,
        failureCount: 0,
        ...(input.url ? { url: input.url.trim() } : {}),
      },
    });
    await audit(db, {
      workspaceId: input.workspaceId,
      actor: { id: input.userId },
      action: "integration.updated",
      target: { type: "integration", id: existing.id, label: "Slack" },
      metadata: { events },
    });
    return;
  }
  if (!input.url)
    throw new AppError("validation_failed", "Paste the webhook URL", { field: "url" });
  await db.webhook.create({
    data: {
      workspaceId: input.workspaceId,
      url: input.url.trim(),
      events,
      format: "slack",
      secret: randomBytes(16).toString("base64url"),
      createdById: input.userId,
    },
  });
  await audit(db, {
    workspaceId: input.workspaceId,
    actor: { id: input.userId },
    action: "integration.connected",
    target: { type: "integration", id: "slack", label: "Slack" },
    metadata: { events },
  });
}

/** Development links on an issue (branches, PRs, commits), newest first. */
export async function listDevLinks(issueId: string) {
  return db.devLink.findMany({
    where: { issueId },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: {
      id: true,
      kind: true,
      title: true,
      url: true,
      state: true,
      author: true,
      updatedAt: true,
    },
  });
}

export type DevLinkItem = Awaited<ReturnType<typeof listDevLinks>>[number];

// ── CSV import ───────────────────────────────────────────────────────────────

const HEADERS: Record<string, string> = {
  summary: "title",
  title: "title",
  description: "description",
  "issue type": "type",
  type: "type",
  priority: "priority",
  status: "status",
  assignee: "assignee",
  "assignee email": "assignee",
  labels: "labels",
  label: "labels",
  "due date": "due",
  due: "due",
  "story points": "points",
  points: "points",
  estimate: "points",
};

const MAX_ROWS = 500;

function toDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Imports issues from a CSV (Jira's export works): Summary required; Issue Type, Priority,
 * Status, Assignee (email or name), Labels (comma/semicolon), Due date, Story points optional.
 * Rows that fail are reported and skipped.
 */
export async function importCsv(input: {
  workspaceId: string;
  userId: string;
  projectKey: string;
  csv: string;
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "issues:create");
  const project = await db.project.findFirst({
    where: { workspaceId: input.workspaceId, key: input.projectKey, archivedAt: null },
    select: {
      id: true,
      statuses: { select: { id: true, name: true } },
      labels: { select: { id: true, name: true } },
    },
  });
  if (!project) throw new AppError("not_found", "Project not found");
  const [header, ...rows] = parseCsv(input.csv);
  if (!header) throw new AppError("validation_failed", "The file is empty");
  const columns = header.map((h) => HEADERS[h.trim().toLowerCase()] ?? null);
  if (!columns.includes("title")) {
    throw new AppError("validation_failed", 'The file needs a "Summary" column');
  }
  if (rows.length > MAX_ROWS) {
    throw new AppError("validation_failed", `Import up to ${MAX_ROWS} rows at a time`);
  }
  const members = await db.workspaceMember.findMany({
    where: { workspaceId: input.workspaceId },
    select: { user: { select: { id: true, email: true, name: true } } },
  });
  const labels = new Map(project.labels.map((l) => [l.name.toLowerCase(), l.id]));
  const errors: { row: number; message: string }[] = [];
  let created = 0;

  for (const [index, row] of rows.entries()) {
    const get = (name: string) => {
      const i = columns.indexOf(name);
      return i >= 0 ? (row[i] ?? "").trim() : "";
    };
    const title = get("title");
    if (!title) {
      errors.push({ row: index + 2, message: "Missing summary" });
      continue;
    }
    const typeRaw = get("type")
      .toLowerCase()
      .replace(/[\s-]+/g, "");
    const type: IssueType = (ISSUE_TYPES as readonly string[]).includes(typeRaw)
      ? (typeRaw as IssueType)
      : typeRaw === "subtask" || typeRaw === "subtasks"
        ? "task"
        : "task";
    const priorityRaw = get("priority").toLowerCase();
    const priority: Priority = (PRIORITIES as readonly string[]).includes(priorityRaw)
      ? (priorityRaw as Priority)
      : "medium";
    const statusName = get("status").toLowerCase();
    const status = project.statuses.find((s) => s.name.toLowerCase() === statusName);
    const who = get("assignee").toLowerCase();
    const assignee = who
      ? members.find((m) => m.user.email.toLowerCase() === who || m.user.name.toLowerCase() === who)
      : undefined;
    const labelIds: string[] = [];
    for (const name of get("labels")
      .split(/[,;]/)
      .map((l) => l.trim())
      .filter(Boolean)) {
      let id = labels.get(name.toLowerCase());
      if (!id) {
        const label = await db.label.create({
          data: { projectId: project.id, name: name.slice(0, 40), color: "gray" },
          select: { id: true },
        });
        id = label.id;
        labels.set(name.toLowerCase(), id);
      }
      labelIds.push(id);
    }
    const points = Number(get("points"));
    try {
      await createIssue({
        workspaceId: input.workspaceId,
        projectId: project.id,
        userId: input.userId,
        title: title.slice(0, 255),
        description: get("description").slice(0, 50_000),
        type,
        priority,
        statusId: status?.id,
        assigneeId: assignee?.user.id ?? null,
        labelIds,
        dueDate: toDate(get("due")),
        estimate: Number.isFinite(points) && get("points") ? Math.round(points) : null,
      });
      created++;
    } catch (error) {
      errors.push({
        row: index + 2,
        message: error instanceof AppError ? error.message : "Couldn't create the issue",
      });
    }
  }
  await audit(db, {
    workspaceId: input.workspaceId,
    actor: { id: input.userId },
    action: "integration.csv_imported",
    target: { type: "project", id: project.id, label: input.projectKey },
    metadata: { created, skipped: errors.length, total: rows.length },
  });
  return { created, errors: errors.slice(0, 50), total: rows.length };
}
