import "server-only";
import { AppError } from "@tracklane/core";
import { db } from "@tracklane/db";
import { assertWorkspacePermission } from "@/server/authz";
import { type FieldValueInput, writeFieldValues } from "./values";

/** Sets one custom field on an issue from the details panel. */
export async function setIssueFieldValue(input: {
  issueId: string;
  fieldId: string;
  userId: string;
  value: FieldValueInput;
}) {
  const issue = await db.issue.findUnique({
    where: { id: input.issueId },
    select: { id: true, workspaceId: true, projectId: true },
  });
  if (!issue) throw new AppError("not_found", "Issue not found");
  await assertWorkspacePermission(issue.workspaceId, input.userId, "issues:update");
  return db.$transaction(async (tx) => {
    const changed = await writeFieldValues(tx, {
      issueId: issue.id,
      projectId: issue.projectId,
      workspaceId: issue.workspaceId,
      userId: input.userId,
      values: { [input.fieldId]: input.value },
      creating: false,
    });
    if (changed)
      await tx.issue.update({ where: { id: issue.id }, data: { updatedAt: new Date() } });
    return { changed };
  });
}
