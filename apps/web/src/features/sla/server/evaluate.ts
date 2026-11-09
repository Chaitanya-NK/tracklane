import "server-only";
import { evaluateSla, formatIssueKey, type SlaResult } from "@tracklane/core";
import { db, type Prisma } from "@tracklane/db";
import { notify } from "@/features/notifications/server/notify";
import { tqlWhere } from "@/features/search/server";

export interface PolicyRow {
  id: string;
  projectId: string;
  name: string;
  query: string;
  metric: "first_response" | "resolution";
  targetMinutes: number;
  warnMinutes: number;
}

const policySelect = {
  id: true,
  projectId: true,
  name: true,
  query: true,
  metric: true,
  targetMinutes: true,
  warnMinutes: true,
} as const;

/**
 * The Prisma filter for a policy's issues: its TQL inside its project. Returns null when the
 * query no longer parses (e.g. it uses a deleted custom field); such a policy matches nothing.
 */
export async function policyWhere(
  policy: PolicyRow,
  workspaceId: string,
  userId = "",
): Promise<Prisma.IssueWhereInput | null> {
  const result = await tqlWhere({ workspaceId, userId, query: policy.query });
  if (!result.ok) return null;
  return { AND: [result.where, { projectId: policy.projectId }] };
}

/** When each issue's clock stopped (first comment by someone else / resolution). */
async function stopTimes(
  policy: PolicyRow,
  issues: { id: string; reporterId: string | null; resolvedAt: Date | null }[],
) {
  if (policy.metric === "resolution") return new Map(issues.map((i) => [i.id, i.resolvedAt]));
  const comments = await db.comment.findMany({
    where: { issueId: { in: issues.map((i) => i.id) } },
    orderBy: { createdAt: "asc" },
    select: { issueId: true, authorId: true, createdAt: true },
  });
  const out = new Map<string, Date | null>(issues.map((i) => [i.id, null]));
  for (const c of comments) {
    const issue = issues.find((i) => i.id === c.issueId);
    if (issue && c.authorId && c.authorId !== issue.reporterId && !out.get(c.issueId)) {
      out.set(c.issueId, c.createdAt);
    }
  }
  return out;
}

export interface IssueSla extends SlaResult {
  policyId: string;
  name: string;
  metric: PolicyRow["metric"];
}

/** Every SLA that applies to one issue, evaluated now. */
export async function slasForIssue(issue: {
  id: string;
  workspaceId: string;
  projectId: string;
  createdAt: Date;
  resolvedAt: Date | null;
  reporterId: string | null;
}): Promise<IssueSla[]> {
  const policies = await db.slaPolicy.findMany({
    where: { projectId: issue.projectId },
    orderBy: { position: "asc" },
    select: policySelect,
  });
  const now = new Date();
  const out: IssueSla[] = [];
  for (const policy of policies) {
    const where = await policyWhere(policy, issue.workspaceId);
    if (!where) continue;
    const matches = await db.issue.count({ where: { AND: [where, { id: issue.id }] } });
    if (!matches) continue;
    const stopped = (await stopTimes(policy, [issue])).get(issue.id) ?? null;
    out.push({
      policyId: policy.id,
      name: policy.name,
      metric: policy.metric,
      ...evaluateSla({
        startedAt: issue.createdAt,
        stoppedAt: stopped,
        targetMinutes: policy.targetMinutes,
        warnMinutes: policy.warnMinutes,
        now,
      }),
    });
  }
  return out;
}

/** Per policy: how its issues created since `since` are doing. */
export async function slaReport(projectId: string, workspaceId: string, since: Date) {
  const policies = await db.slaPolicy.findMany({
    where: { projectId },
    orderBy: { position: "asc" },
    select: policySelect,
  });
  const now = new Date();
  const rows = [];
  for (const policy of policies) {
    const where = await policyWhere(policy, workspaceId);
    const issues = where
      ? await db.issue.findMany({
          where: { AND: [where, { createdAt: { gte: since } }] },
          select: {
            id: true,
            number: true,
            title: true,
            createdAt: true,
            resolvedAt: true,
            reporterId: true,
            project: { select: { key: true } },
          },
          take: 2000,
        })
      : [];
    const stops = await stopTimes(policy, issues);
    const counts = { running: 0, at_risk: 0, breached: 0, met: 0, missed: 0 };
    const worst: { key: string; title: string; remainingMinutes: number; state: string }[] = [];
    for (const issue of issues) {
      const result = evaluateSla({
        startedAt: issue.createdAt,
        stoppedAt: stops.get(issue.id) ?? null,
        targetMinutes: policy.targetMinutes,
        warnMinutes: policy.warnMinutes,
        now,
      });
      counts[result.state]++;
      if (result.state === "breached" || result.state === "at_risk") {
        worst.push({
          key: formatIssueKey(issue.project.key, issue.number),
          title: issue.title,
          remainingMinutes: result.remainingMinutes,
          state: result.state,
        });
      }
    }
    const finished = counts.met + counts.missed;
    rows.push({
      policy,
      valid: Boolean(where),
      total: issues.length,
      counts,
      /** Share of finished clocks that met the target, 0–100 (null when none finished). */
      metRate: finished ? Math.round((counts.met / finished) * 100) : null,
      attention: worst.sort((a, b) => a.remainingMinutes - b.remainingMinutes).slice(0, 10),
    });
  }
  return rows;
}

/**
 * Worker entry point (every 5 minutes): notifies the assignee (or the project lead) once when
 * an open issue's SLA becomes at risk, and once when it's breached.
 */
export async function checkSlas(now = new Date()) {
  const policies = await db.slaPolicy.findMany({
    select: {
      ...policySelect,
      project: { select: { workspaceId: true, leadId: true, archivedAt: true } },
    },
  });
  let sent = 0;
  for (const policy of policies) {
    if (policy.project.archivedAt) continue;
    const where = await policyWhere(policy, policy.project.workspaceId);
    if (!where) continue;
    const issues = await db.issue.findMany({
      where: {
        AND: [
          where,
          policy.metric === "resolution" ? { resolvedAt: null } : {},
          // Ignore ancient issues (a month past the target); warnings already went out or are moot.
          {
            createdAt: {
              gte: new Date(now.getTime() - (policy.targetMinutes + 30 * 1440) * 60_000),
            },
          },
        ],
      },
      select: {
        id: true,
        number: true,
        workspaceId: true,
        assigneeId: true,
        reporterId: true,
        resolvedAt: true,
        createdAt: true,
        project: { select: { key: true } },
      },
      take: 1000,
    });
    const stops = await stopTimes(policy, issues);
    for (const issue of issues) {
      const result = evaluateSla({
        startedAt: issue.createdAt,
        stoppedAt: stops.get(issue.id) ?? null,
        targetMinutes: policy.targetMinutes,
        warnMinutes: policy.warnMinutes,
        now,
      });
      const kind =
        result.state === "breached"
          ? "sla_breached"
          : result.state === "at_risk"
            ? "sla_at_risk"
            : null;
      if (!kind) continue;
      const recipient = issue.assigneeId ?? policy.project.leadId;
      if (!recipient) continue;
      const { count } = await db.slaNotice.createMany({
        data: [{ policyId: policy.id, issueId: issue.id, kind }],
        skipDuplicates: true,
      });
      if (!count) continue;
      const key = formatIssueKey(issue.project.key, issue.number);
      await db.$transaction((tx) =>
        notify(tx, {
          type: kind,
          workspaceId: issue.workspaceId,
          issueId: issue.id,
          actorId: null,
          recipientIds: [recipient],
          title:
            kind === "sla_breached"
              ? `${key} missed "${policy.name}"`
              : `${key} is close to missing "${policy.name}"`,
          body:
            kind === "sla_breached"
              ? "The SLA target has passed."
              : `Due in ${result.remainingMinutes} minutes.`,
        }),
      );
      sent++;
    }
  }
  return sent;
}
