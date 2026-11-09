import "server-only";
import { findIssueKeys, parseIssueKey, parseSmartCommits } from "@tracklane/core";
import { db, type Prisma } from "@tracklane/db";
import { addComment, updateIssue } from "@/features/issues/server/service";
import { logWork } from "@/features/time/server/service";

export interface GitHubConfig {
  repo: string;
  autoTransition: boolean;
  smartCommits: boolean;
  /** Who changes issues on GitHub's behalf (the admin who connected it). */
  actorId: string;
}

/** Verifies GitHub's X-Hub-Signature-256 header (HMAC-SHA256 of the raw body). */
export async function verifyGitHubSignature(secret: string, body: string, header: string | null) {
  if (!header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  const expected = `sha256=${Buffer.from(mac).toString("hex")}`;
  if (expected.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

async function issuesFor(workspaceId: string, text: string) {
  const keys = findIssueKeys(text)
    .map(parseIssueKey)
    .filter((k): k is NonNullable<typeof k> => Boolean(k));
  if (!keys.length) return [];
  return db.issue.findMany({
    where: {
      workspaceId,
      OR: keys.map((k) => ({ number: k.number, project: { key: k.projectKey } })),
    },
    select: {
      id: true,
      number: true,
      projectId: true,
      project: { select: { key: true } },
      status: { select: { category: true } },
    },
  });
}

async function upsertLink(
  data: Omit<Prisma.DevLinkUncheckedCreateInput, "id" | "createdAt" | "updatedAt">,
) {
  await db.devLink.upsert({
    where: {
      issueId_kind_externalId: {
        issueId: data.issueId,
        kind: data.kind,
        externalId: data.externalId,
      },
    },
    create: data,
    update: { title: data.title, url: data.url, state: data.state, author: data.author },
  });
}

/** First status of a category in the project's workflow (by position). */
async function statusIn(projectId: string, category: "in_progress" | "done") {
  return db.workflowStatus.findFirst({
    where: { projectId, category },
    orderBy: { position: "asc" },
    select: { id: true },
  });
}

/** A status named like the smart-commit command ("done", "in review"), else by category. */
async function statusNamed(projectId: string, name: string) {
  const exact = await db.workflowStatus.findFirst({
    where: { projectId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (exact) return exact;
  if (/^(done|close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)$/.test(name)) {
    return statusIn(projectId, "done");
  }
  if (/^(start|started|in progress|wip)$/.test(name)) return statusIn(projectId, "in_progress");
  return null;
}

async function moveTo(issueId: string, actorId: string, statusId: string) {
  try {
    await updateIssue({ issueId, userId: actorId, patch: { statusId }, source: "automation" });
  } catch {
    // The workflow may not allow the move; development links still get recorded.
  }
}

/** Handles one GitHub webhook delivery. Returns what it did, for the response body. */
/** The fields of GitHub webhook payloads that we read (pull_request, create, push). */
export interface GitHubPayload {
  action?: string;
  ref?: string;
  ref_type?: string;
  repository?: { html_url?: string };
  sender?: { login?: string };
  pull_request?: {
    number: number;
    title: string;
    body?: string | null;
    state: string;
    merged?: boolean;
    html_url: string;
    head?: { ref?: string };
    user?: { login?: string };
  };
  commits?: {
    id: string;
    message?: string;
    url: string;
    author?: { username?: string; name?: string };
  }[];
}

export async function handleGitHubEvent(
  workspaceId: string,
  config: GitHubConfig,
  event: string,
  payload: GitHubPayload,
) {
  let linked = 0;
  let moved = 0;
  if (event === "ping") return { ok: true, linked, moved };

  if (event === "pull_request" && payload.pull_request) {
    const pr = payload.pull_request;
    const state = pr.merged ? "merged" : pr.state;
    const issues = await issuesFor(
      workspaceId,
      `${pr.title} ${pr.head?.ref ?? ""} ${pr.body ?? ""}`,
    );
    for (const issue of issues) {
      await upsertLink({
        issueId: issue.id,
        kind: "pull_request",
        externalId: String(pr.number),
        title: `#${pr.number} ${pr.title}`,
        url: pr.html_url,
        state,
        author: pr.user?.login ?? "",
      });
      linked++;
      if (!config.autoTransition) continue;
      if (payload.action === "opened" && issue.status.category === "todo") {
        const target = await statusIn(issue.projectId, "in_progress");
        if (target) {
          await moveTo(issue.id, config.actorId, target.id);
          moved++;
        }
      }
      if (payload.action === "closed" && pr.merged && issue.status.category !== "done") {
        const target = await statusIn(issue.projectId, "done");
        if (target) {
          await moveTo(issue.id, config.actorId, target.id);
          moved++;
        }
      }
    }
  }

  if (event === "create" && payload.ref_type === "branch" && payload.ref) {
    const issues = await issuesFor(workspaceId, payload.ref);
    for (const issue of issues) {
      await upsertLink({
        issueId: issue.id,
        kind: "branch",
        externalId: payload.ref,
        title: payload.ref,
        url: `${payload.repository?.html_url ?? ""}/tree/${encodeURIComponent(payload.ref)}`,
        state: null,
        author: payload.sender?.login ?? "",
      });
      linked++;
    }
  }

  if (event === "push") {
    for (const commit of payload.commits ?? []) {
      const message: string = commit.message ?? "";
      const issues = await issuesFor(workspaceId, message);
      for (const issue of issues) {
        await upsertLink({
          issueId: issue.id,
          kind: "commit",
          externalId: commit.id,
          title: message.split("\n")[0]!.slice(0, 200),
          url: commit.url,
          state: null,
          author: commit.author?.username ?? commit.author?.name ?? "",
        });
        linked++;
      }
      if (!config.smartCommits) continue;
      for (const sc of parseSmartCommits(message)) {
        const issue = issues.find((i) => `${i.project.key}-${i.number}` === sc.key);
        if (!issue) continue;
        if (sc.comment) {
          await addComment({
            issueId: issue.id,
            userId: config.actorId,
            body: `${sc.comment}\n\n_via commit [${String(commit.id).slice(0, 7)}](${commit.url})_`,
            source: "automation",
          }).catch(() => undefined);
        }
        if (sc.timeMinutes) {
          await logWork({
            issueId: issue.id,
            userId: config.actorId,
            minutes: sc.timeMinutes,
            date: new Date().toISOString().slice(0, 10),
            note: `Commit ${String(commit.id).slice(0, 7)}`,
          }).catch(() => undefined);
        }
        if (sc.transition) {
          const target = await statusNamed(issue.projectId, sc.transition);
          if (target) {
            await moveTo(issue.id, config.actorId, target.id);
            moved++;
          }
        }
      }
    }
  }
  return { ok: true, linked, moved };
}
