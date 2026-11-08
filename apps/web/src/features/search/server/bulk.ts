import "server-only";
import { AppError, formatIssueKey, type Priority } from "@tracklane/core";
import { db } from "@tracklane/db";
import { deleteIssue, updateIssue } from "@/features/issues/server";
import { assertWorkspacePermission } from "@/server/authz";

export const MAX_BULK = 200;

export interface BulkPatch {
  assigneeId?: string | null;
  priority?: Priority;
  /** Matched by name in each issue's project (workflows differ per project). */
  statusName?: string;
  /** Only when every selected issue is in the same project; null = backlog. */
  sprintId?: string | null;
  addLabelName?: string;
}

/**
 * Applies the same change to many issues. Each issue goes through the normal update path, so
 * validation, permissions and history all apply. Issues that can't take the change are skipped
 * and reported rather than failing the whole batch.
 */
export async function bulkUpdate(input: {
  workspaceId: string;
  userId: string;
  issueIds: string[];
  patch: BulkPatch;
}) {
  if (input.issueIds.length > MAX_BULK)
    throw new AppError("validation_failed", `Select at most ${MAX_BULK} issues`);
  await assertWorkspacePermission(input.workspaceId, input.userId, "issues:update");
  const issues = await db.issue.findMany({
    where: { id: { in: input.issueIds }, workspaceId: input.workspaceId },
    select: {
      id: true,
      number: true,
      projectId: true,
      project: { select: { key: true, statuses: { select: { id: true, name: true } } } },
      labels: { select: { labelId: true } },
    },
  });
  if (input.patch.sprintId !== undefined && new Set(issues.map((i) => i.projectId)).size > 1) {
    throw new AppError(
      "validation_failed",
      "Moving to a sprint works for issues from one project at a time",
    );
  }

  let updated = 0;
  const skipped: { key: string; reason: string }[] = [];
  for (const issue of issues) {
    const key = formatIssueKey(issue.project.key, issue.number);
    const patch: Parameters<typeof updateIssue>[0]["patch"] = {};
    if (input.patch.assigneeId !== undefined) patch.assigneeId = input.patch.assigneeId;
    if (input.patch.priority) patch.priority = input.patch.priority;
    if (input.patch.sprintId !== undefined) patch.sprintId = input.patch.sprintId;
    if (input.patch.statusName) {
      const status = issue.project.statuses.find(
        (s) => s.name.toLowerCase() === input.patch.statusName!.toLowerCase(),
      );
      if (!status) {
        skipped.push({
          key,
          reason: `${issue.project.key} has no "${input.patch.statusName}" status`,
        });
        continue;
      }
      patch.statusId = status.id;
    }
    if (input.patch.addLabelName) {
      const label = await db.label.upsert({
        where: { projectId_name: { projectId: issue.projectId, name: input.patch.addLabelName } },
        update: {},
        create: { projectId: issue.projectId, name: input.patch.addLabelName },
        select: { id: true },
      });
      patch.labelIds = [...new Set([...issue.labels.map((l) => l.labelId), label.id])];
    }
    try {
      await updateIssue({ issueId: issue.id, userId: input.userId, patch });
      updated++;
    } catch (error) {
      skipped.push({ key, reason: error instanceof AppError ? error.message : "Couldn't update" });
    }
  }
  return { updated, skipped };
}

export async function bulkDelete(input: {
  workspaceId: string;
  userId: string;
  issueIds: string[];
}) {
  if (input.issueIds.length > MAX_BULK)
    throw new AppError("validation_failed", `Select at most ${MAX_BULK} issues`);
  await assertWorkspacePermission(input.workspaceId, input.userId, "issues:delete");
  const issues = await db.issue.findMany({
    where: { id: { in: input.issueIds }, workspaceId: input.workspaceId },
    select: { id: true },
  });
  const storageKeys: string[] = [];
  for (const issue of issues) {
    const result = await deleteIssue({ issueId: issue.id, userId: input.userId });
    storageKeys.push(...result.storageKeys);
  }
  return { deleted: issues.length, storageKeys };
}
