import "server-only";
import { audit } from "@/server/audit";
import { AppError, DEFAULT_RESOLUTIONS, slugify } from "@tracklane/core";
import { db, Prisma } from "@tracklane/db";
import { assertWorkspacePermission } from "@/server/authz";

/** Finds a free slug based on the requested one: acme-labs, acme-labs-2, acme-labs-3… */
async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "workspace";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const taken = await db.workspace.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  throw new AppError("conflict", "Couldn't find a free workspace URL. Try a different name.");
}

export async function createWorkspace(input: { name: string; slug?: string; userId: string }) {
  const slug = input.slug ?? (await uniqueSlug(input.name));
  try {
    return await db.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: input.name,
          slug,
          createdById: input.userId,
          members: { create: { userId: input.userId, role: "owner" } },
          resolutions: {
            create: DEFAULT_RESOLUTIONS.map((r, position) => ({
              name: r.name,
              description: r.description,
              isDefault: "isDefault" in r && r.isDefault,
              position,
            })),
          },
        },
        select: { id: true, name: true, slug: true },
      });
      await audit(tx, {
        workspaceId: workspace.id,
        actor: { id: input.userId },
        action: "workspace.created",
        target: { type: "workspace", id: workspace.id, label: workspace.name },
      });
      await tx.user.update({
        where: { id: input.userId },
        data: { lastWorkspaceId: workspace.id },
      });
      return workspace;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("conflict", "That workspace URL is already taken", { field: "slug" });
    }
    throw error;
  }
}

export async function updateWorkspace(input: {
  workspaceId: string;
  userId: string;
  name: string;
  slug: string;
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "workspace:update");
  try {
    const before = await db.workspace.findUniqueOrThrow({
      where: { id: input.workspaceId },
      select: { name: true, slug: true },
    });
    const updated = await db.workspace.update({
      where: { id: input.workspaceId },
      data: { name: input.name, slug: input.slug },
      select: { id: true, name: true, slug: true },
    });
    await audit(db, {
      workspaceId: input.workspaceId,
      actor: { id: input.userId },
      action: "workspace.updated",
      target: { type: "workspace", id: updated.id, label: updated.name },
      metadata: { from: before, to: { name: updated.name, slug: updated.slug } },
    });
    return updated;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("conflict", "That workspace URL is already taken", { field: "slug" });
    }
    throw error;
  }
}

export async function deleteWorkspace(input: {
  workspaceId: string;
  userId: string;
  confirmName: string;
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "workspace:delete");
  const workspace = await db.workspace.findUniqueOrThrow({
    where: { id: input.workspaceId },
    select: { name: true },
  });
  if (workspace.name !== input.confirmName) {
    throw new AppError("validation_failed", "Type the workspace name exactly to confirm", {
      field: "confirmName",
    });
  }
  await db.workspace.delete({ where: { id: input.workspaceId } });
}

/** Remembers the workspace the user opened last, so "/" can take them back there. */
export async function rememberLastWorkspace(userId: string, workspaceId: string) {
  await db.user.update({ where: { id: userId }, data: { lastWorkspaceId: workspaceId } });
}

/** Onboarding answers; used to pick sensible defaults (e.g. the first project's template). */
export async function setWorkspaceProfile(input: {
  workspaceId: string;
  userId: string;
  teamSize: string;
  useCases: string[];
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "workspace:update");
  await db.workspace.update({
    where: { id: input.workspaceId },
    data: { teamSize: input.teamSize, useCases: input.useCases },
  });
}
