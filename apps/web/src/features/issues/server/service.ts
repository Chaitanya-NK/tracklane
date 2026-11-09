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
  formatDuration,
} from "@tracklane/core";
import { db, type Prisma } from "@tracklane/db";
import {
  onCommentAdded,
  onIssueCreated,
  onIssueUpdated,
} from "@/features/notifications/server/issue-events";
import { scheduleAutomation } from "@/features/automation/server/schedule";
import { defaultResolutionId, resolutionFields } from "@/features/resolutions/server/apply";
import { type FieldValueInput, writeFieldValues } from "@/features/custom-fields/server/values";
import { gateStatusChange, type StatusChange } from "@/features/workflow/server/transition";
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
  startDate: true,
  estimate: true,
  timeEstimate: true,
  releaseId: true,
  customTypeId: true,
  release: { select: { name: true } },
  customType: { select: { name: true } },
  statusId: true,
  assigneeId: true,
  parentId: true,
  sprintId: true,
  resolvedAt: true,
  resolutionId: true,
  resolution: { select: { name: true } },
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
    type: issue.customType?.name ?? ISSUE_TYPE_LABELS[issue.type],
    priority: PRIORITY_LABELS[issue.priority],
    status: issue.status.name,
    assignee: issue.assignee?.name ?? null,
    startDate: toDateString(issue.startDate),
    dueDate: toDateString(issue.dueDate),
    estimate: issue.estimate,
    parent: issue.parent ? formatIssueKey(issue.project.key, issue.parent.number) : null,
    labels: issue.labels.map((l) => l.label.name),
    sprint: issue.sprint?.name ?? null,
    resolution: issue.resolution?.name ?? null,
    timeEstimate: issue.timeEstimate === null ? null : formatDuration(issue.timeEstimate),
    release: issue.release?.name ?? null,
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
    releaseId?: string | null;
    customTypeId?: string | null;
  },
) {
  if (refs.releaseId) {
    const release = await tx.release.findFirst({
      where: { id: refs.releaseId, projectId: ctx.projectId },
      select: { status: true },
    });
    if (!release) throw new AppError("validation_failed", "That release isn't in this project");
    if (release.status === "archived")
      throw new AppError("validation_failed", "That release is archived");
  }
  if (refs.customTypeId) {
    const custom = await tx.projectIssueType.findFirst({
      where: { id: refs.customTypeId, projectId: ctx.projectId },
      select: { baseType: true },
    });
    if (!custom) throw new AppError("validation_failed", "That issue type isn't in this project");
    if (custom.baseType !== refs.type) {
      throw new AppError("validation_failed", "The issue type doesn't match its base type");
    }
  }
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
  startDate?: string | null;
  dueDate?: string | null;
  estimate?: number | null;
  labelIds?: string[];
  sprintId?: string | null;
  /** Custom field values by field id. Required fields must be present. */
  fieldValues?: Record<string, FieldValueInput>;
  releaseId?: string | null;
  customTypeId?: string | null;
  /** Set by automation and recurring issues, so they don't trigger automation again. */
  source?: "automation";
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

  if (input.startDate && input.dueDate && input.startDate > input.dueDate) {
    throw new AppError("validation_failed", "The start date must be on or before the due date", {
      field: "startDate",
    });
  }
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
        startDate: input.startDate ? new Date(`${input.startDate}T00:00:00Z`) : null,
        dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00Z`) : null,
        estimate: input.estimate ?? null,
        releaseId: input.releaseId ?? null,
        customTypeId: input.customTypeId ?? null,
        position: await nextPosition(tx, project.id),
        // A subtask lives in its parent's sprint unless one was given explicitly.
        sprintId:
          input.sprintId !== undefined
            ? input.sprintId
            : input.type === "subtask" && input.parentId
              ? ((
                  await tx.issue.findUnique({
                    where: { id: input.parentId },
                    select: { sprintId: true },
                  })
                )?.sprintId ?? null)
              : null,
        ...(status.category === "done"
          ? {
              resolvedAt: new Date(),
              resolutionId: await defaultResolutionId(tx, input.workspaceId),
            }
          : {}),
        labels: input.labelIds?.length
          ? { create: [...new Set(input.labelIds)].map((labelId) => ({ labelId })) }
          : undefined,
        activities: { create: { actorId: input.userId, action: "created" } },
      },
      select: { id: true, number: true },
    });
    await onIssueCreated(
      tx,
      {
        id: issue.id,
        workspaceId: input.workspaceId,
        projectId: project.id,
        assigneeId: input.assigneeId ?? null,
      },
      input.userId,
    );
    if (input.source !== "automation") {
      scheduleAutomation([{ trigger: "issue_created", issueId: issue.id, projectId: project.id }]);
    }
    await writeFieldValues(tx, {
      issueId: issue.id,
      projectId: project.id,
      workspaceId: input.workspaceId,
      userId: input.userId,
      values: input.fieldValues ?? {},
      creating: true,
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
  startDate?: string | null;
  dueDate?: string | null;
  estimate?: number | null;
  labelIds?: string[];
  sprintId?: string | null;
  /** Only for issues in (or moving to) a Done status; defaults to the workspace default. */
  resolutionId?: string;
  /** Original time estimate in minutes. */
  timeEstimate?: number | null;
  releaseId?: string | null;
  customTypeId?: string | null;
}

export async function updateIssue(input: {
  issueId: string;
  userId: string;
  patch: IssuePatch;
  /** Set only when applying an approved transition: the workflow gate was already passed. */
  approved?: boolean;
  /** "automation": changes made by a rule, which don't trigger rules again. */
  source?: "automation";
}) {
  return db.$transaction(async (tx) => {
    const before = await loadIssue(tx, input.issueId);
    await assertWorkspacePermission(before.workspaceId, input.userId, "issues:update");
    const patch = { ...input.patch };
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
        releaseId: patch.releaseId,
        customTypeId:
          patch.customTypeId !== undefined
            ? patch.customTypeId
            : patch.type && patch.type !== before.type
              ? null
              : before.customTypeId,
      },
    );

    let statusChange: StatusChange = { kind: "apply" };
    if (patch.statusId && !input.approved) {
      statusChange = await gateStatusChange(tx, {
        issue: before,
        toStatusId: patch.statusId,
        userId: input.userId,
      });
      // Waiting for approval: everything else in the patch still applies.
      if (statusChange.kind === "approval") {
        delete patch.statusId;
        // The resolution is picked again (or defaulted) when the move is approved.
        delete patch.resolutionId;
      }
    }

    const resolution = await resolutionFields(tx, {
      workspaceId: before.workspaceId,
      before: {
        statusId: before.statusId,
        category: before.status.category,
        resolutionId: before.resolutionId,
      },
      nextStatusId: patch.statusId,
      resolutionId: patch.resolutionId,
    });
    const nextStart =
      patch.startDate !== undefined ? patch.startDate : toDateString(before.startDate);
    const nextDue = patch.dueDate !== undefined ? patch.dueDate : toDateString(before.dueDate);
    if (nextStart && nextDue && nextStart > nextDue) {
      throw new AppError("validation_failed", "The start date must be on or before the due date", {
        field: "startDate",
      });
    }

    await tx.issue.update({
      where: { id: before.id },
      data: {
        title: patch.title,
        description: patch.description,
        type: patch.type,
        priority: patch.priority,
        statusId: patch.statusId,
        sprintId: patch.sprintId,
        ...resolution,
        assigneeId: patch.assigneeId,
        parentId: patch.parentId,
        estimate: patch.estimate,
        timeEstimate: patch.timeEstimate,
        releaseId: patch.releaseId,
        // Changing the base type drops a custom type of another base.
        customTypeId:
          patch.customTypeId !== undefined
            ? patch.customTypeId
            : patch.type && patch.type !== before.type
              ? null
              : undefined,
        startDate:
          patch.startDate === undefined
            ? undefined
            : patch.startDate
              ? new Date(`${patch.startDate}T00:00:00Z`)
              : null,
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

    if (patch.sprintId !== undefined && patch.sprintId !== before.sprintId) {
      await moveSubtasksWithParent(tx, before.id, patch.sprintId, input.userId);
    }
    const changed = await recordChanges(tx, before, input.userId, input.source);
    return {
      key: formatIssueKey(before.project.key, before.number),
      changed,
      approval: statusChange.kind === "approval" ? { toStatus: statusChange.toStatus } : null,
    };
  });
}

/** resolvedAt follows the status category: set when entering "done", cleared when leaving it. */
/** Writes one history row per changed field. Returns how many fields changed. */
async function recordChanges(tx: Tx, before: IssueRow, actorId: string, source?: "automation") {
  const after = await loadIssue(tx, before.id);
  const changes = diffIssue(snapshot(before), snapshot(after));
  if (changes.length) await onIssueUpdated(tx, before, after, actorId);
  if (changes.length && source !== "automation") {
    const base = { issueId: after.id, projectId: after.projectId };
    scheduleAutomation([
      ...(after.statusId !== before.statusId
        ? [{ trigger: "status_changed" as const, toStatusId: after.statusId, ...base }]
        : []),
      ...(after.assigneeId !== before.assigneeId
        ? [{ trigger: "assignee_changed" as const, ...base }]
        : []),
      ...(after.priority !== before.priority
        ? [{ trigger: "priority_changed" as const, ...base }]
        : []),
    ]);
  }
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

/**
 * Subtasks belong to their parent's sprint (as in Jira): when a parent moves between sprints
 * or to the backlog, its subtasks move with it, each with a history entry.
 */
async function moveSubtasksWithParent(
  tx: Tx,
  parentId: string,
  sprintId: string | null,
  actorId: string,
) {
  const subtasks = await tx.issue.findMany({
    where: {
      parentId,
      type: "subtask",
      NOT: { sprintId },
      // Work recorded in a completed sprint stays there (it's that sprint's history).
      OR: [{ sprintId: null }, { sprint: { state: { not: "completed" } } }],
    },
    select: { id: true },
  });
  for (const subtask of subtasks) {
    const before = await loadIssue(tx, subtask.id);
    await tx.issue.update({ where: { id: subtask.id }, data: { sprintId } });
    await recordChanges(tx, before, actorId);
  }
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
  /** Board swimlanes: dropping into another lane changes that lane's field too. */
  assigneeId?: string | null;
  priority?: Priority;
  parentId?: string | null;
  /** When the move enters a Done status (resolve dialog). */
  resolutionId?: string;
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
      {
        type: before.type,
        statusId: input.statusId,
        sprintId: input.sprintId,
        assigneeId: input.assigneeId,
        parentId: input.parentId !== undefined ? input.parentId : before.parentId,
      },
    );
    let statusId = input.statusId;
    let statusChange: StatusChange = { kind: "apply" };
    if (statusId) {
      statusChange = await gateStatusChange(tx, {
        issue: before,
        toStatusId: statusId,
        userId: input.userId,
      });
      if (statusChange.kind === "approval") statusId = undefined;
    }

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
        statusId,
        sprintId: input.sprintId,
        assigneeId: input.assigneeId,
        priority: input.priority,
        parentId: input.parentId,
        position: position ?? undefined,
        ...(await resolutionFields(tx, {
          workspaceId: before.workspaceId,
          before: {
            statusId: before.statusId,
            category: before.status.category,
            resolutionId: before.resolutionId,
          },
          nextStatusId: statusId,
          resolutionId: statusId ? input.resolutionId : undefined,
        })),
      },
    });
    if (input.sprintId !== undefined && input.sprintId !== before.sprintId) {
      await moveSubtasksWithParent(tx, before.id, input.sprintId, input.userId);
    }
    await recordChanges(tx, before, input.userId);
    return {
      key: formatIssueKey(before.project.key, before.number),
      approval: statusChange.kind === "approval" ? { toStatus: statusChange.toStatus } : null,
    };
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

export async function addComment(input: {
  issueId: string;
  userId: string;
  body: string;
  source?: "automation";
}) {
  const workspaceId = await issueWorkspace(input.issueId);
  await assertWorkspacePermission(workspaceId, input.userId, "comments:create");
  return db.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: { issueId: input.issueId, authorId: input.userId, body: input.body },
      select: { id: true, issue: { select: { id: true, workspaceId: true, projectId: true } } },
    });
    await tx.issueActivity.create({
      data: { issueId: input.issueId, actorId: input.userId, action: "commented" },
    });
    await onCommentAdded(tx, comment.issue, input.userId, input.body);
    if (input.source !== "automation") {
      scheduleAutomation([
        { trigger: "comment_added", issueId: comment.issue.id, projectId: comment.issue.projectId },
      ]);
    }
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
