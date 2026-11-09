import "server-only";
import { AppError } from "@tracklane/core";
import { db, type Prisma } from "@tracklane/db";
import { assertWorkspacePermission } from "@/server/authz";

/** Stored scenes are capped so one board can't bloat the database. */
const MAX_SCENE_BYTES = 4_000_000;

export function listWhiteboards(workspaceId: string) {
  return db.whiteboard.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      project: { select: { key: true, name: true } },
      createdBy: { select: { id: true, name: true, image: true } },
    },
  });
}

export function getWhiteboard(workspaceId: string, id: string) {
  return db.whiteboard.findFirst({
    where: { id, workspaceId },
    select: {
      id: true,
      name: true,
      scene: true,
      version: true,
      project: { select: { key: true, name: true } },
    },
  });
}

export async function createWhiteboard(input: {
  workspaceId: string;
  userId: string;
  name: string;
  projectId: string | null;
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "issues:update");
  if (input.projectId) {
    const ok = await db.project.count({
      where: { id: input.projectId, workspaceId: input.workspaceId },
    });
    if (!ok) throw new AppError("validation_failed", "Project not found");
  }
  return db.whiteboard.create({
    data: {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      name: input.name,
      createdById: input.userId,
      scene: { elements: [] },
    },
    select: { id: true, name: true },
  });
}

/** Last write wins: the boards are kept in step live, so every client holds the same scene. */
export async function saveWhiteboardScene(input: {
  workspaceId: string;
  userId: string;
  id: string;
  scene: { elements: unknown[]; viewBackgroundColor?: string };
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "issues:update");
  if (JSON.stringify(input.scene).length > MAX_SCENE_BYTES) {
    throw new AppError(
      "validation_failed",
      "This board is too large to save. Remove some images or shapes.",
    );
  }
  const { count } = await db.whiteboard.updateMany({
    where: { id: input.id, workspaceId: input.workspaceId },
    data: { scene: input.scene as Prisma.InputJsonValue, version: { increment: 1 } },
  });
  if (!count) throw new AppError("not_found", "Whiteboard not found");
}

export async function renameWhiteboard(
  workspaceId: string,
  userId: string,
  id: string,
  name: string,
) {
  await assertWorkspacePermission(workspaceId, userId, "issues:update");
  const { count } = await db.whiteboard.updateMany({ where: { id, workspaceId }, data: { name } });
  if (!count) throw new AppError("not_found", "Whiteboard not found");
}

export async function deleteWhiteboard(workspaceId: string, userId: string, id: string) {
  await assertWorkspacePermission(workspaceId, userId, "issues:update");
  const { count } = await db.whiteboard.deleteMany({ where: { id, workspaceId } });
  if (!count) throw new AppError("not_found", "Whiteboard not found");
}
