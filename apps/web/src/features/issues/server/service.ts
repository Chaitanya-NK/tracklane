import "server-only";
import {
  ALLOWED_PARENT_TYPES,
  evenRanks,
  rankBetween,
  AppError,
  formatIssueKey,
  ISSUE_TYPE_LABELS,
  type IssueType,
  PRIORITY_LABELS,
  type Priority,
} from "@tracklane/core";
import { db, type Prisma } from "@tracklane/db";
import { assertWorkspacePermission } from "@/server/authz";
import { diffIssue, type IssueSnapshot } from "../activity";

type Tx = Prisma.TransactionClient;

const snapshotSelect = {
  id: true,
  workspaceId: true,
  projectId: true,
  number: true,
  title: true,
  description: true,
  type: true,
  priority: true,
  dueDate: true,
  estimate: true,
  statusId: true,
  assigneeId: true,
  parentId: true,
  sprintId: true,
  resolvedAt: true,
  project: { select: { key: true } },
  status: { select: { name: true, category: true } },
  assignee: { select: { name: true } },
  parent: { select: { number: true } },
  sprint: { select: { name: true } },
  labels: { select: { label: { select: { id: true, name: true } } } },
  _count: { select: { children: true } },
} satisfies Prisma.IssueSelect;

type IssueRow = Prisma.IssueGetPayload<{ select: typeof snapshotSelect }>;

const toDateString = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null);

function snapshot(issue: IssueRow): IssueSnapshot {
  return {
    title: issue.title,
    description: issue.description,
    type: ISSUE_TYPE_LABELS[issue.type],
    priority: PRIORITY_LABELS[issue.priority],
    status: issue.status.name,
    assignee: issue.assignee?.name ?? null,
    dueDate: toDateString(issue.dueDate),
    estimate: issue.estimate,
    parent: issue.parent ? formatIssueKey(issue.project.key, issue.parent.number) : null,
    labels: issue.labels.map((l) => l.label.name),
    sprint: issue.sprint?.name ?? null,
  };
}

async function loadIssue(tx: Tx, issueId: string): Promise<IssueRow> {
  const issue = await tx.issue.findUnique({ where: { id: issueId }, select: snapshotSelect });
  if (!issue) throw new AppError("not_found", "Issue not found");
  return issue;
}

/** Checks that everything an issue points to belongs to the same project / workspace. */
async function validateReferences(
  tx: Tx,
  ctx: { workspaceId: string; projectId: string; issueId?: string },
  refs: {
    type: IssueType;
    statusId?: string;
    assigneeId?: string | null;
    parentId?: string | null;
    labelIds?: string[];
    sprintId?: string | null;
  },
) {
  if (refs.statusId) {
    const status = await tx.workflowStatus.findFirst({
      where: { id: refs.statusId, projectId: ctx.projectId },
      select: { id: true },
    });
    if (!status) throw new AppError("validation_failed", "That status isn't in this project");
  }
  if (refs.assigneeId) {
    const member = await tx.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: ctx.workspaceId, userId: refs.assigneeId } },
      select: { role: true },
    });
    if (!member || member.role === "guest") {
      throw new AppError("validation_failed", "Issues can only be assigned to workspace members");
    }
  }
  if (refs.type === "subtask" && !refs.parentId) {
    throw new AppError("validation_failed", "A subtask needs a parent issue", {
      field: "parentId",
    });
  }
  if (refs.parentId) {
    if (refs.parentId === ctx.issueId) {
      throw new AppError("validation_failed", "An issue can't be its own parent");
    }
    const parent = await tx.issue.findFirst({
      where: { id: refs.parentId, projectId: ctx.projectId },
      select: { type: true },
    });
    if (!parent) throw new AppError("validation_failed", "The parent must be in the same project");
    if (!ALLOWED_PARENT_TYPES[refs.type].includes(parent.type)) {
      throw new AppError(
        "validation_failed",
        `A ${ISSUE_TYPE_LABELS[refs.type].toLowerCase()} can't have a ${ISSUE_TYPE_LABELS[parent.type].toLowerCase()} as its parent`,
        { field: "parentId" },
      );
    }
  }
  if (refs.sprintId) {
    const sprint = await tx.sprint.findFirst({
      where: { id: refs.sprintId, projectId: ctx.projectId },
      select: { state: true },
    });
    if (!sprint) throw new AppError("validation_failed", "That sprint isn't in this project");
    if (sprint.state === "completed") {
      throw new AppError("validation_failed", "Issues can't be added to a completed sprint");
    }
  }
  if (refs.labelIds?.length) {
    const count = await tx.label.count({
      where: { id: { in: refs.labelIds }, projectId: ctx.projectId },
    });
    if (count !== new Set(refs.labelIds).size) {
      throw new AppError("validation_failed", "Some labels aren't in this project");
    }
  }
}

/** Rank for a new issue: after everything else in the project. */
async function nextPosition(tx: Tx, projectId: string) {
  const last = await tx.issue.aggregate({ where: { projectId }, _max: { position: true } });
  return rankBetween(last._max.position, undefined)!;
}

export interface CreateIssueInput {
  workspaceId: string;
  projectId: string;
  userId: string;
  title: string;
  type: IssueType;
  priority: Priority;
  description?: string;
  statusId?: string;
  assigneeId?: string | null;
  parentId?: string | null;
  dueDate?: string | null;
  estimate?: number | null;
  labelIds?: string[];
  sprintId?: string | null;
}

export async function createIssue(input: CreateIssueInput) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "issues:create");
  const project = await db.project.findFirst({
    where: { id: input.projectId, workspaceId: input.workspaceId, archivedAt: null },
    select: {
      id: true,
      key: true,
      statuses: { orderBy: { position: "asc" }, take: 1, select: { id: true } },
    },
  });
  if (!project) throw new AppError("not_found", "Project not found");
  const statusId = input.statusId ?? project.statuses[0]?.id;
  if (!statusId) throw new AppError("conflict", "This project has no workflow statuses");

  return db.$transaction(async (tx) => {
    await validateReferences(
      tx,
      { workspaceId: input.workspaceId, projectId: project.id },
      { ...input, statusId },
    );
    // Row-locks the project, so concurrent creates get consecutive numbers.
    const { issueCounter: number } = await tx.project.update({
      where: { id: project.id },
      data: { issueCounter: { increment: 1 } },
      select: { issueCounter: true },
    });
    const status = await tx.workflowStatus.findUniqueOrThrow({
      where: { id: statusId },
      select: { category: true },
    });
    const issue = await tx.issue.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: project.id,
        number,
        title: input.title,
        type: input.type,
        priority: input.priority,
        description: input.description ?? "",
        statusId,
        assigneeId: input.assigneeId ?? null,
        reporterId: input.userId,
        parentId: input.parentId ?? null,
        dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00Z`) : null,
        estimate: input.estimate ?? null,
        position: await nextPosition(tx, project.id),
        sprintId: input.sprintId ?? null,
        resolvedAt: status.category === "done" ? new Date() : null,
        labels: input.labelIds?.length
          ? { create: [...new Set(input.labelIds)].map((labelId) => ({ labelId })) }
          : undefined,
        activities: { create: { actorId: input.userId, action: "created" } },
      },
      select: { id: true, number: true },
    });
    await tx.project.update({ where: { id: project.id }, data: { updatedAt: new Date() } });
    return { id: issue.id, key: formatIssueKey(project.key, issue.number) };
  });
}

export interface IssuePatch {
  title?: string;
  description?: string;
  type?: IssueType;
  priority?: Priority;
  statusId?: string;
  assigneeId?: string | null;
  parentId?: string | null;
  dueDate?: string | null;
  estimate?: number | null;
  labelIds?: string[];
  sprintId?: string | null;
}

export async function updateIssue(input: { issueId: string; userId: string; patch: IssuePatch }) {
  return db.$transaction(async (tx) => {
    const before = await loadIssue(tx, input.issueId);
    await assertWorkspacePermission(before.workspaceId, input.userId, "issues:update");
    const { patch } = input;
    const type = patch.type ?? before.type;

    if (patch.type && patch.type !== before.type && before._count.children > 0) {
      throw new AppError(
        "conflict",
        "Move or remove this issue's child issues before changing its type",
      );
    }
    const parentId = patch.parentId !== undefined ? patch.parentId : before.parentId;
    await validateReferences(
      tx,
      { workspaceId: before.workspaceId, projectId: before.projectId, issueId: before.id },
      {
        type,
        statusId: patch.statusId,
        assigneeId: patch.assigneeId,
        parentId,
        labelIds: patch.labelIds,
        sprintId: patch.sprintId,
      },
    );

    const resolvedAt = await resolvedAtFor(tx, before, patch.statusId);

    await tx.issue.update({
      where: { id: before.id },
      data: {
        title: patch.title,
        description: patch.description,
        type: patch.type,
        priority: patch.priority,
        statusId: patch.statusId,
        sprintId: patch.sprintId,
        resolvedAt,
        assigneeId: patch.assigneeId,
        parentId: patch.parentId,
        estimate: patch.estimate,
        dueDate:
          patch.dueDate === undefined
            ? undefined
            : patch.dueDate
              ? new Date(`${patch.dueDate}T00:00:00Z`)
              : null,
        labels: patch.labelIds
          ? {
              deleteMany: {},
              create: [...new Set(patch.labelIds)].map((labelId) => ({ labelId })),
            }
          : undefined,
      },
    });

    const changed = await recordChanges(tx, before, input.userId);
    return { key: formatIssueKey(before.project.key, before.number), changed };
  });
}

/** resolvedAt follows the status category: set when entering "done", cleared when leaving it. */
async function resolvedAtFor(tx: Tx, before: IssueRow, statusId: string | undefined) {
  if (!statusId || statusId === before.statusId) return undefined;
  const status = await tx.workflowStatus.findUniqueOrThrow({
    where: { id: statusId },
    select: { category: true },
  });
  const wasDone = before.status.category === "done";
  const isDone = status.category === "done";
  if (isDone && !wasDone) return new Date();
  if (!isDone && wasDone) return null;
  return undefined;
}

/** Writes one history row per changed field. Returns how many fields changed. */
async function recordChanges(tx: Tx, before: IssueRow, actorId: string) {
  const after = await loadIssue(tx, before.id);
  const changes = diffIssue(snapshot(before), snapshot(after));
  if (changes.length) {
    await tx.issueActivity.createMany({
      data: changes.map((change) => ({
        issueId: before.id,
        actorId,
        action: "updated",
        ...change,
      })),
    });
  }
  return changes.length;
}

/** Renumbers every issue in the project by its current order (rare; keeps ranks precise). */
async function rebalanceRanks(tx: Tx, projectId: string) {
  const issues = await tx.issue.findMany({
    where: { projectId },
    orderBy: [{ position: "asc" }, { number: "asc" }],
    select: { id: true },
  });
  const ranks = evenRanks(issues.length);
  await Promise.all(
    issues.map((issue, i) =>
      tx.issue.update({ where: { id: issue.id }, data: { position: ranks[i] } }),
    ),
  );
}

export interface MoveIssueInput {
  issueId: string;
  userId: string;
  /** New column on the board. */
  statusId?: string;
  /** New sprint; null moves it to the backlog. */
  sprintId?: string | null;
  /** Neighbours in the destination list after the drop (either may be missing). */
  beforeId?: string | null;
  afterId?: string | null;
}

/**
 * Drag and drop: changes status and/or sprint, and places the issue between two neighbours.
 * Ranks are project-wide, so the same order shows on the board and in the backlog.
 */
export async function moveIssue(input: MoveIssueInput) {
  return db.$transaction(async (tx) => {
    const before = await loadIssue(tx, input.issueId);
    await assertWorkspacePermission(before.workspaceId, input.userId, "issues:update");
    if (input.sprintId !== undefined && input.sprintId !== before.sprintId) {
      await assertWorkspacePermission(before.workspaceId, input.userId, "sprints:manage");
    }
    await validateReferences(
      tx,
      { workspaceId: before.workspaceId, projectId: before.projectId, issueId: before.id },
      { type: before.type, statusId: input.statusId, sprintId: input.sprintId },
    );

    const neighbourIds = [input.beforeId, input.afterId].filter((id): id is string => Boolean(id));
    const loadNeighbours = () =>
      tx.issue.findMany({
        where: { id: { in: neighbourIds }, projectId: before.projectId },
        select: { id: true, position: true },
      });
    let neighbours = await loadNeighbours();
    const rankOf = (id: string | null | undefined) => neighbours.find((n) => n.id === id)?.position;
    let position: number | null | undefined =
      neighbourIds.length > 0
        ? rankBetween(rankOf(input.beforeId), rankOf(input.afterId))
        : undefined;
    if (position === null) {
      await rebalanceRanks(tx, before.projectId);
      neighbours = await loadNeighbours();
      position = rankBetween(rankOf(input.beforeId), rankOf(input.afterId));
    }

    await tx.issue.update({
      where: { id: before.id },
      data: {
        statusId: input.statusId,
        sprintId: input.sprintId,
        position: position ?? undefined,
        resolvedAt: await resolvedAtFor(tx, before, input.statusId),
      },
    });
    await recordChanges(tx, before, input.userId);
    return { key: formatIssueKey(before.project.key, before.number) };
  });
}

/** Deletes an issue (and its subtasks' parent link). Returns attachment keys to remove. */
export async function deleteIssue(input: { issueId: string; userId: string }) {
  const issue = await db.issue.findUnique({
    where: { id: input.issueId },
    select: {
      workspaceId: true,
      reporterId: true,
      project: { select: { key: true } },
      attachments: { select: { storageKey: true } },
    },
  });
  if (!issue) throw new AppError("not_found", "Issue not found");
  await assertWorkspacePermission(issue.workspaceId, input.userId, "issues:delete");
  await db.issue.delete({ where: { id: input.issueId } });
  return { projectKey: issue.project.key, storageKeys: issue.attachments.map((a) => a.storageKey) };
}

// ── Comments ────────────────────────────────────────────────────────────────

async function issueWorkspace(issueId: string) {
  const issue = await db.issue.findUnique({
    where: { id: issueId },
    select: { workspaceId: true },
  });
  if (!issue) throw new AppError("not_found", "Issue not found");
  return issue.workspaceId;
}

export async function addComment(input: { issueId: string; userId: string; body: string }) {
  const workspaceId = await issueWorkspace(input.issueId);
  await assertWorkspacePermission(workspaceId, input.userId, "comments:create");
  return db.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: { issueId: input.issueId, authorId: input.userId, body: input.body },
      select: { id: true },
    });
    await tx.issueActivity.create({
      data: { issueId: input.issueId, actorId: input.userId, action: "commented" },
    });
    return comment;
  });
}

/** Authors manage their own comments; admins (comments:moderate) can manage anyone's. */
async function assertCanManageComment(commentId: string, userId: string) {
  const comment = await db.comment.findUnique({
    where: { id: commentId },
    select: { authorId: true, issue: { select: { workspaceId: true } } },
  });
  if (!comment) throw new AppError("not_found", "Comment not found");
  if (comment.authorId === userId) {
    await assertWorkspacePermission(comment.issue.workspaceId, userId, "comments:create");
  } else {
    await assertWorkspacePermission(comment.issue.workspaceId, userId, "comments:moderate");
  }
}

export async function updateComment(input: { commentId: string; userId: string; body: string }) {
  await assertCanManageComment(input.commentId, input.userId);
  await db.comment.update({
    where: { id: input.commentId },
    data: { body: input.body, editedAt: new Date() },
  });
}

export async function deleteComment(input: { commentId: string; userId: string }) {
  await assertCanManageComment(input.commentId, input.userId);
  await db.comment.delete({ where: { id: input.commentId } });
}

// ── Attachments ─────────────────────────────────────────────────────────────

export async function recordAttachment(input: {
  issueId: string;
  userId: string;
  filename: string;
  contentType: string;
  size: number;
  storageKey: string;
}) {
  return db.$transaction(async (tx) => {
    const attachment = await tx.attachment.create({
      data: {
        issueId: input.issueId,
        uploaderId: input.userId,
        filename: input.filename,
        contentType: input.contentType,
        size: input.size,
        storageKey: input.storageKey,
      },
      select: { id: true, filename: true, contentType: true, size: true, createdAt: true },
    });
    await tx.issueActivity.create({
      data: {
        issueId: input.issueId,
        actorId: input.userId,
        action: "attachment_added",
        toValue: input.filename,
      },
    });
    return attachment;
  });
}

/** Uploaders remove their own files; anyone who can delete issues can remove any. */
export async function deleteAttachment(input: { attachmentId: string; userId: string }) {
  const attachment = await db.attachment.findUnique({
    where: { id: input.attachmentId },
    select: {
      issueId: true,
      uploaderId: true,
      filename: true,
      storageKey: true,
      issue: { select: { workspaceId: true } },
    },
  });
  if (!attachment) throw new AppError("not_found", "Attachment not found");
  await assertWorkspacePermission(
    attachment.issue.workspaceId,
    input.userId,
    attachment.uploaderId === input.userId ? "issues:update" : "issues:delete",
  );
  await db.$transaction([
    db.attachment.delete({ where: { id: input.attachmentId } }),
    db.issueActivity.create({
      data: {
        issueId: attachment.issueId,
        actorId: input.userId,
        action: "attachment_removed",
        fromValue: attachment.filename,
      },
    }),
  ]);
  return attachment.storageKey;
}
