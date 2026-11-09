import "server-only";
import { AppError } from "@tracklane/core";
import { db, Prisma } from "@tracklane/db";
import { assertWorkspacePermission } from "@/server/authz";

export async function listResolutions(workspaceId: string) {
  const rows = await db.resolution.findMany({
    where: { workspaceId },
    orderBy: { position: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      isDefault: true,
      _count: { select: { issues: true } },
    },
  });
  return rows.map(({ _count, ...r }) => ({ ...r, issueCount: _count.issues }));
}

export type ResolutionItem = Awaited<ReturnType<typeof listResolutions>>[number];

function duplicate(error: unknown, name: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new AppError("conflict", `There's already a resolution called ${name}`, {
      field: "name",
    });
  }
  throw error;
}

async function owned(workspaceId: string, resolutionId: string) {
  const found = await db.resolution.findFirst({
    where: { id: resolutionId, workspaceId },
    select: { id: true, name: true, isDefault: true },
  });
  if (!found) throw new AppError("not_found", "Resolution not found");
  return found;
}

export async function createResolution(input: {
  workspaceId: string;
  userId: string;
  name: string;
  description: string;
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "workspace:update");
  const count = await db.resolution.count({ where: { workspaceId: input.workspaceId } });
  if (count >= 50) throw new AppError("conflict", "A workspace can have at most 50 resolutions");
  return db.resolution
    .create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        description: input.description,
        position: count,
        isDefault: count === 0,
      },
      select: { id: true, name: true },
    })
    .catch((error) => duplicate(error, input.name));
}

export async function updateResolution(input: {
  workspaceId: string;
  userId: string;
  resolutionId: string;
  name: string;
  description: string;
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "workspace:update");
  await owned(input.workspaceId, input.resolutionId);
  return db.resolution
    .update({
      where: { id: input.resolutionId },
      data: { name: input.name, description: input.description },
      select: { id: true, name: true },
    })
    .catch((error) => duplicate(error, input.name));
}

/** The default is used when an issue is resolved without choosing (board drag, bulk edit). */
export async function setDefaultResolution(input: {
  workspaceId: string;
  userId: string;
  resolutionId: string;
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "workspace:update");
  await owned(input.workspaceId, input.resolutionId);
  await db.$transaction([
    db.resolution.updateMany({
      where: { workspaceId: input.workspaceId },
      data: { isDefault: false },
    }),
    db.resolution.update({ where: { id: input.resolutionId }, data: { isDefault: true } }),
  ]);
}

export async function reorderResolutions(input: {
  workspaceId: string;
  userId: string;
  resolutionIds: string[];
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "workspace:update");
  const rows = await db.resolution.findMany({
    where: { workspaceId: input.workspaceId },
    select: { id: true },
  });
  const known = new Set(rows.map((r) => r.id));
  if (
    rows.length !== input.resolutionIds.length ||
    input.resolutionIds.some((id) => !known.has(id))
  ) {
    throw new AppError("validation_failed", "The list changed; reload and try again");
  }
  await db.$transaction(
    input.resolutionIds.map((id, position) =>
      db.resolution.update({ where: { id }, data: { position } }),
    ),
  );
}

/** Deletes a resolution, moving its issues to another one (which becomes default if needed). */
export async function deleteResolution(input: {
  workspaceId: string;
  userId: string;
  resolutionId: string;
  replacementId?: string;
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "workspace:update");
  const target = await owned(input.workspaceId, input.resolutionId);
  return db.$transaction(async (tx) => {
    const others = await tx.resolution.findMany({
      where: { workspaceId: input.workspaceId, id: { not: target.id } },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    if (!others.length) throw new AppError("conflict", "Keep at least one resolution");
    const replacement = input.replacementId ?? others[0]!.id;
    if (replacement === target.id || !others.some((o) => o.id === replacement)) {
      throw new AppError("validation_failed", "Choose another resolution for its issues");
    }
    const { count } = await tx.issue.updateMany({
      where: { resolutionId: target.id },
      data: { resolutionId: replacement },
    });
    await tx.resolution.delete({ where: { id: target.id } });
    if (target.isDefault) {
      await tx.resolution.update({ where: { id: replacement }, data: { isDefault: true } });
    }
    return { moved: count };
  });
}
