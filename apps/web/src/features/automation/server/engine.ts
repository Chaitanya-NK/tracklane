import "server-only";
import { AppError, formatIssueKey, PRIORITY_LABELS } from "@tracklane/core";
import { db } from "@tracklane/db";
import { addComment, updateIssue } from "@/features/issues/server/service";
import { notify, watcherIds } from "@/features/notifications/server/notify";
import { tqlWhere } from "@/features/search/server";
import { type AutomationAction, parseActions } from "../rules";
import type { AutomationEvent } from "./schedule";

type Rule = {
  id: string;
  name: string;
  condition: string;
  actions: unknown;
  createdById: string | null;
  project: { workspaceId: string; leadId: string | null };
};

async function log(
  ruleId: string,
  issueId: string | null,
  status: "success" | "skipped" | "failed",
  message: string,
) {
  await db.automationRun.create({
    data: { ruleId, issueId, status, message: message.slice(0, 500) },
  });
}

/** Does the issue match the rule's TQL condition (empty = always)? */
async function matches(rule: Rule, issueId: string, actorId: string) {
  if (!rule.condition.trim()) return true;
  const where = await tqlWhere({
    workspaceId: rule.project.workspaceId,
    userId: actorId,
    query: rule.condition,
  });
  if (!where.ok) throw new AppError("validation_failed", `Condition: ${where.message}`);
  return (await db.issue.count({ where: { AND: [where.where, { id: issueId }] } })) > 0;
}

async function apply(
  rule: Rule,
  action: AutomationAction,
  issueId: string,
  actorId: string,
): Promise<string> {
  const run = { issueId, userId: actorId, source: "automation" as const };
  switch (action.type) {
    case "set_assignee": {
      const issue = await db.issue.findUniqueOrThrow({
        where: { id: issueId },
        select: { reporterId: true },
      });
      const assigneeId =
        action.to === "none" ? null : action.to === "reporter" ? issue.reporterId : action.to;
      await updateIssue({ ...run, patch: { assigneeId } });
      return assigneeId ? "assigned" : "unassigned";
    }
    case "set_priority":
      await updateIssue({ ...run, patch: { priority: action.priority } });
      return `priority ${PRIORITY_LABELS[action.priority]}`;
    case "transition": {
      const result = await updateIssue({ ...run, patch: { statusId: action.statusId } });
      return result.approval ? "sent for approval" : "moved";
    }
    case "add_label": {
      const issue = await db.issue.findUniqueOrThrow({
        where: { id: issueId },
        select: { labels: { select: { labelId: true } } },
      });
      const ids = issue.labels.map((l) => l.labelId);
      if (ids.includes(action.labelId)) return "label already there";
      await updateIssue({ ...run, patch: { labelIds: [...ids, action.labelId] } });
      return "label added";
    }
    case "add_comment":
      await addComment({ issueId, userId: actorId, body: action.body, source: "automation" });
      return "commented";
    case "notify": {
      const issue = await db.issue.findUniqueOrThrow({
        where: { id: issueId },
        select: {
          workspaceId: true,
          number: true,
          assigneeId: true,
          reporterId: true,
          project: { select: { key: true } },
        },
      });
      const key = formatIssueKey(issue.project.key, issue.number);
      await db.$transaction(async (tx) => {
        const to =
          action.to === "watchers"
            ? await watcherIds(tx, issueId)
            : [action.to === "assignee" ? issue.assigneeId : issue.reporterId];
        await notify(tx, {
          type: "status_changed",
          workspaceId: issue.workspaceId,
          issueId,
          actorId: null,
          recipientIds: to.filter((id): id is string => Boolean(id)),
          title: `${rule.name}: ${key}`,
          body: action.message,
        });
      });
      return "notified";
    }
  }
}

/** Runs one rule against one issue, logging the outcome. Never throws. */
export async function runRule(rule: Rule, issueId: string) {
  const actorId = rule.createdById ?? rule.project.leadId;
  if (!actorId)
    return log(rule.id, issueId, "failed", "The rule's owner left; edit and save it again");
  try {
    if (!(await matches(rule, issueId, actorId)))
      return log(rule.id, issueId, "skipped", "Condition not met");
    const actions = parseActions(rule.actions);
    const done: string[] = [];
    for (const action of actions) done.push(await apply(rule, action, issueId, actorId));
    await log(rule.id, issueId, "success", done.join(", "));
  } catch (error) {
    await log(
      rule.id,
      issueId,
      "failed",
      error instanceof Error ? error.message : "Something went wrong",
    );
  }
}

const ruleSelect = {
  id: true,
  name: true,
  condition: true,
  actions: true,
  createdById: true,
  toStatusId: true,
  project: { select: { workspaceId: true, leadId: true } },
} as const;

/** Entry point for events from the issue service (after the request). */
export async function runAutomations(events: AutomationEvent[]) {
  for (const event of events) {
    const rules = await db.automationRule.findMany({
      where: { projectId: event.projectId, enabled: true, trigger: event.trigger },
      orderBy: { position: "asc" },
      select: ruleSelect,
    });
    for (const rule of rules) {
      if (
        event.trigger === "status_changed" &&
        rule.toStatusId &&
        rule.toStatusId !== event.toStatusId
      )
        continue;
      await runRule(rule, event.issueId);
    }
  }
}

/** Daily rules: run for every open issue matching the condition (capped per rule). */
export async function runDailyAutomations() {
  const rules = await db.automationRule.findMany({
    where: { enabled: true, trigger: "scheduled_daily", project: { archivedAt: null } },
    select: { ...ruleSelect, projectId: true },
  });
  let runs = 0;
  for (const rule of rules) {
    const actorId = rule.createdById ?? rule.project.leadId ?? "";
    const where = rule.condition.trim()
      ? await tqlWhere({
          workspaceId: rule.project.workspaceId,
          userId: actorId,
          query: rule.condition,
        })
      : { ok: true as const, where: {} };
    if (!where.ok) {
      await log(rule.id, null, "failed", `Condition: ${where.message}`);
      continue;
    }
    const issues = await db.issue.findMany({
      where: {
        AND: [where.where, { projectId: rule.projectId, status: { category: { not: "done" } } }],
      },
      select: { id: true },
      take: 200,
    });
    for (const issue of issues) {
      await runRule(rule, issue.id);
      runs++;
    }
  }
  return runs;
}
