import "server-only";
import { AppError, type StatusCategory, type WorkspaceRole } from "@tracklane/core";
import { db, Prisma } from "@tracklane/db";
import { defaultResolutionId } from "@/features/resolutions/server/apply";
import { assertWorkspacePermission } from "@/server/authz";

type Tx = Prisma.TransactionClient;

/** Loads a project in the workspace and checks the caller may edit its workflow. */
async function editableProject(workspaceId: string, projectId: string, userId: string) {
  await assertWorkspacePermission(workspaceId, userId, "projects:update");
  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true, type: true, backlogStatusId: true },
  });
  if (!project) throw new AppError("not_found", "Project not found");
  return project;
}

async function statusInProject(tx: Tx, projectId: string, statusId: string) {
  const status = await tx.workflowStatus.findFirst({
    where: { id: statusId, projectId },
    select: { id: true, name: true, category: true },
  });
  if (!status) throw new AppError("not_found", "Status not found");
  return status;
}

function duplicateName(error: unknown, name: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new AppError("conflict", `There's already a status called ${name}`, { field: "name" });
  }
  throw error;
}

/**
 * resolvedAt and the resolution follow the status category, so changing a category (or moving
 * issues into another status) re-stamps them: Done gets the default resolution where missing.
 */
async function syncResolvedAt(tx: Tx, statusId: string, category: StatusCategory) {
  if (category === "done") {
    const status = await tx.workflowStatus.findUniqueOrThrow({
      where: { id: statusId },
      select: { project: { select: { workspaceId: true } } },
    });
    await tx.issue.updateMany({
      where: { statusId, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
    await tx.issue.updateMany({
      where: { statusId, resolutionId: null },
      data: { resolutionId: await defaultResolutionId(tx, status.project.workspaceId) },
    });
  } else {
    await tx.issue.updateMany({
      where: { statusId },
      data: { resolvedAt: null, resolutionId: null },
    });
  }
}

export async function createStatus(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  name: string;
  category: StatusCategory;
}) {
  await editableProject(input.workspaceId, input.projectId, input.userId);
  const last = await db.workflowStatus.findFirst({
    where: { projectId: input.projectId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return db
    .$transaction(async (tx) => {
      const status = await tx.workflowStatus.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          category: input.category,
          position: (last?.position ?? -1) + 1,
        },
        select: { id: true, name: true },
      });
      // With enforcement on, a new status starts connected both ways to every other one, so
      // it isn't a dead end; the admin narrows it down in the grid.
      const project = await tx.project.findUniqueOrThrow({
        where: { id: input.projectId },
        select: { restrictTransitions: true, statuses: { select: { id: true } } },
      });
      if (project.restrictTransitions) {
        const others = project.statuses.filter((s) => s.id !== status.id);
        await tx.workflowTransition.createMany({
          data: others.flatMap((other) => [
            { projectId: input.projectId, fromStatusId: other.id, toStatusId: status.id },
            { projectId: input.projectId, fromStatusId: status.id, toStatusId: other.id },
          ]),
        });
      }
      return status;
    })
    .catch((error) => duplicateName(error, input.name));
}

export async function updateStatus(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  statusId: string;
  name: string;
  category: StatusCategory;
}) {
  await editableProject(input.workspaceId, input.projectId, input.userId);
  return db
    .$transaction(async (tx) => {
      const before = await statusInProject(tx, input.projectId, input.statusId);
      const status = await tx.workflowStatus.update({
        where: { id: input.statusId },
        data: { name: input.name, category: input.category },
        select: { id: true, name: true },
      });
      if (before.category !== input.category) {
        await syncResolvedAt(tx, input.statusId, input.category);
      }
      return status;
    })
    .catch((error) => duplicateName(error, input.name));
}

export async function reorderStatuses(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  statusIds: string[];
}) {
  await editableProject(input.workspaceId, input.projectId, input.userId);
  await db.$transaction(async (tx) => {
    const statuses = await tx.workflowStatus.findMany({
      where: { projectId: input.projectId },
      select: { id: true },
    });
    const known = new Set(statuses.map((s) => s.id));
    if (
      input.statusIds.length !== statuses.length ||
      input.statusIds.some((id) => !known.has(id)) ||
      new Set(input.statusIds).size !== input.statusIds.length
    ) {
      throw new AppError("validation_failed", "The status list changed; reload and try again");
    }
    await Promise.all(
      input.statusIds.map((id, position) =>
        tx.workflowStatus.update({ where: { id }, data: { position } }),
      ),
    );
  });
}

/** Deletes a status after moving its issues (and pending approvals' targets) elsewhere. */
export async function deleteStatus(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  statusId: string;
  moveToStatusId?: string;
}) {
  await editableProject(input.workspaceId, input.projectId, input.userId);
  return db.$transaction(async (tx) => {
    const status = await statusInProject(tx, input.projectId, input.statusId);
    const count = await tx.workflowStatus.count({ where: { projectId: input.projectId } });
    if (count <= 1) throw new AppError("conflict", "A project needs at least one status");
    const issues = await tx.issue.count({ where: { statusId: status.id } });
    if (issues > 0) {
      if (!input.moveToStatusId || input.moveToStatusId === status.id) {
        throw new AppError("validation_failed", "Choose where this status's issues should go", {
          field: "moveToStatusId",
        });
      }
      const target = await statusInProject(tx, input.projectId, input.moveToStatusId);
      const moved = await tx.issue.findMany({
        where: { statusId: status.id },
        select: { id: true },
      });
      await tx.issue.updateMany({ where: { statusId: status.id }, data: { statusId: target.id } });
      await syncResolvedAt(tx, target.id, target.category);
      await tx.issueActivity.createMany({
        data: moved.map((issue) => ({
          issueId: issue.id,
          actorId: input.userId,
          action: "updated",
          field: "status",
          fromValue: status.name,
          toValue: target.name,
        })),
      });
    }
    await tx.workflowStatus.delete({ where: { id: status.id } });
    // Close the gap in positions.
    const rest = await tx.workflowStatus.findMany({
      where: { projectId: input.projectId },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    await Promise.all(
      rest.map((s, position) =>
        tx.workflowStatus.update({ where: { id: s.id }, data: { position } }),
      ),
    );
    return { moved: issues };
  });
}

/**
 * Turns transition rules on or off. With enforcement off every pair counts as allowed, so
 * turning it on writes that out as explicit rules (keeping approval rules as they are): what the
 * admin saw stays true, and they then remove the moves they want to block.
 */
export async function setRestrictTransitions(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  restrict: boolean;
}) {
  await editableProject(input.workspaceId, input.projectId, input.userId);
  await db.$transaction(async (tx) => {
    if (input.restrict) {
      const statuses = await tx.workflowStatus.findMany({
        where: { projectId: input.projectId },
        select: { id: true },
      });
      await tx.workflowTransition.createMany({
        data: statuses.flatMap((from) =>
          statuses
            .filter((to) => to.id !== from.id)
            .map((to) => ({
              projectId: input.projectId,
              fromStatusId: from.id,
              toStatusId: to.id,
            })),
        ),
        skipDuplicates: true,
      });
    }
    await tx.project.update({
      where: { id: input.projectId },
      data: { restrictTransitions: input.restrict },
    });
  });
}

/** Adds, changes or removes the rule for one from → to pair. */
export async function setTransition(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  fromStatusId: string;
  toStatusId: string;
  allowed: boolean;
  requiresApproval: boolean;
  approverRole: WorkspaceRole;
}) {
  await editableProject(input.workspaceId, input.projectId, input.userId);
  if (input.fromStatusId === input.toStatusId) {
    throw new AppError("validation_failed", "A status always allows staying where it is");
  }
  if (input.approverRole === "guest" || input.approverRole === "viewer") {
    throw new AppError("validation_failed", "Approvers must be members or above");
  }
  await db.$transaction(async (tx) => {
    await statusInProject(tx, input.projectId, input.fromStatusId);
    await statusInProject(tx, input.projectId, input.toStatusId);
    const where = {
      fromStatusId_toStatusId: { fromStatusId: input.fromStatusId, toStatusId: input.toStatusId },
    };
    if (!input.allowed) {
      await tx.workflowTransition.deleteMany({
        where: { fromStatusId: input.fromStatusId, toStatusId: input.toStatusId },
      });
      return;
    }
    const data = { requiresApproval: input.requiresApproval, approverRole: input.approverRole };
    await tx.workflowTransition.upsert({
      where,
      update: data,
      create: {
        projectId: input.projectId,
        fromStatusId: input.fromStatusId,
        toStatusId: input.toStatusId,
        ...data,
      },
    });
  });
}

/** Kanban: issues in this status live in the Backlog tab instead of on the board. */
export async function setBacklogStatus(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  statusId: string | null;
}) {
  const project = await editableProject(input.workspaceId, input.projectId, input.userId);
  if (project.type !== "kanban") {
    throw new AppError("validation_failed", "Scrum projects plan their backlog with sprints");
  }
  if (input.statusId) {
    const status = await statusInProject(db, input.projectId, input.statusId);
    if (status.category !== "todo") {
      throw new AppError("validation_failed", "The backlog status must be a To do status");
    }
  }
  await db.project.update({
    where: { id: input.projectId },
    data: { backlogStatusId: input.statusId },
  });
}

/** Sets (or clears, with null) the board column's work-in-progress limit. */
export async function setWipLimit(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  statusId: string;
  limit: number | null;
}) {
  await editableProject(input.workspaceId, input.projectId, input.userId);
  const { count } = await db.workflowStatus.updateMany({
    where: { id: input.statusId, projectId: input.projectId },
    data: { wipLimit: input.limit },
  });
  if (!count) throw new AppError("not_found", "Status not found");
}
