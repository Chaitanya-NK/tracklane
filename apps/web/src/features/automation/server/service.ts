import "server-only";
import { AppError } from "@tracklane/core";
import { db } from "@tracklane/db";
import { tqlWhere } from "@/features/search/server";
import { assertWorkspacePermission } from "@/server/authz";
import { type AutomationAction, type AutomationTrigger, parseActions } from "../rules";

export interface RuleInput {
  name: string;
  trigger: AutomationTrigger;
  toStatusId: string | null;
  condition: string;
  actions: AutomationAction[];
}

export async function listRules(projectId: string) {
  const rules = await db.automationRule.findMany({
    where: { projectId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      enabled: true,
      trigger: true,
      toStatusId: true,
      condition: true,
      actions: true,
      createdBy: { select: { name: true } },
      runs: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, createdAt: true } },
    },
  });
  return rules.map((r) => ({ ...r, actions: parseActions(r.actions), lastRun: r.runs[0] ?? null }));
}

export async function listRuns(projectId: string) {
  return db.automationRun.findMany({
    where: { rule: { projectId } },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      status: true,
      message: true,
      createdAt: true,
      rule: { select: { name: true } },
      issue: { select: { number: true, project: { select: { key: true } } } },
    },
  });
}

/** Checks references (statuses, labels, people) belong to the project / workspace. */
async function check(workspaceId: string, projectId: string, userId: string, input: RuleInput) {
  await assertWorkspacePermission(workspaceId, userId, "projects:update");
  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true },
  });
  if (!project) throw new AppError("not_found", "Project not found");
  if (input.condition.trim()) {
    const where = await tqlWhere({ workspaceId, userId, query: input.condition });
    if (!where.ok) throw new AppError("validation_failed", where.message, { field: "condition" });
  }
  if (input.trigger === "scheduled_daily" && !input.condition.trim()) {
    throw new AppError(
      "validation_failed",
      "Daily rules need a condition (e.g. due < startOfDay())",
      {
        field: "condition",
      },
    );
  }
  const statusIds = [
    input.toStatusId,
    ...input.actions.flatMap((a) => (a.type === "transition" ? [a.statusId] : [])),
  ].filter((id): id is string => Boolean(id));
  if (statusIds.length) {
    const found = await db.workflowStatus.count({ where: { id: { in: statusIds }, projectId } });
    if (found !== new Set(statusIds).size)
      throw new AppError("validation_failed", "A status isn't in this project");
  }
  const labelIds = input.actions.flatMap((a) => (a.type === "add_label" ? [a.labelId] : []));
  if (
    labelIds.length &&
    (await db.label.count({ where: { id: { in: labelIds }, projectId } })) !==
      new Set(labelIds).size
  ) {
    throw new AppError("validation_failed", "A label isn't in this project");
  }
  const people = input.actions.flatMap((a) =>
    a.type === "set_assignee" && a.to !== "reporter" && a.to !== "none" ? [a.to] : [],
  );
  if (
    people.length &&
    (await db.workspaceMember.count({ where: { workspaceId, userId: { in: people } } })) !==
      new Set(people).size
  ) {
    throw new AppError("validation_failed", "Assign rules can only use workspace members");
  }
}

export async function saveRule(
  workspaceId: string,
  projectId: string,
  userId: string,
  ruleId: string | null,
  input: RuleInput,
) {
  await check(workspaceId, projectId, userId, input);
  const data = {
    name: input.name,
    trigger: input.trigger,
    toStatusId: input.trigger === "status_changed" ? input.toStatusId : null,
    condition: input.condition.trim(),
    actions: input.actions,
    // Rules act as whoever last saved them.
    createdById: userId,
  };
  if (ruleId) {
    const { count } = await db.automationRule.updateMany({
      where: { id: ruleId, projectId },
      data,
    });
    if (!count) throw new AppError("not_found", "Rule not found");
    return { id: ruleId, name: input.name };
  }
  const position = await db.automationRule.count({ where: { projectId } });
  return db.automationRule.create({
    data: { ...data, projectId, position },
    select: { id: true, name: true },
  });
}

export async function setRuleEnabled(
  workspaceId: string,
  projectId: string,
  userId: string,
  ruleId: string,
  enabled: boolean,
) {
  await assertWorkspacePermission(workspaceId, userId, "projects:update");
  const { count } = await db.automationRule.updateMany({
    where: { id: ruleId, projectId, project: { workspaceId } },
    data: { enabled },
  });
  if (!count) throw new AppError("not_found", "Rule not found");
}

export async function deleteRule(
  workspaceId: string,
  projectId: string,
  userId: string,
  ruleId: string,
) {
  await assertWorkspacePermission(workspaceId, userId, "projects:update");
  const { count } = await db.automationRule.deleteMany({
    where: { id: ruleId, projectId, project: { workspaceId } },
  });
  if (!count) throw new AppError("not_found", "Rule not found");
}
