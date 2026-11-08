import "server-only";
import { AppError, DEFAULT_WORKFLOW, type LabelColor, type ProjectType } from "@tracklane/core";
import { db, Prisma } from "@tracklane/db";
import { assertWorkspacePermission } from "@/server/authz";

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createProject(input: {
  workspaceId: string;
  userId: string;
  name: string;
  key: string;
  type: ProjectType;
  description?: string;
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "projects:create");
  try {
    return await db.project.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        key: input.key,
        type: input.type,
        description: input.description ?? "",
        leadId: input.userId,
        createdById: input.userId,
        statuses: {
          create: DEFAULT_WORKFLOW.map((status, position) => ({ ...status, position })),
        },
      },
      select: { id: true, key: true, name: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("conflict", `A project with key ${input.key} already exists`, {
        field: "key",
      });
    }
    throw error;
  }
}

export async function updateProject(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  name: string;
  description: string;
  leadId: string | null;
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "projects:update");
  if (input.leadId) {
    const isMember = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.leadId } },
      select: { id: true },
    });
    if (!isMember) throw new AppError("validation_failed", "The lead must be a workspace member");
  }
  return db.project.update({
    where: { id: input.projectId, workspaceId: input.workspaceId },
    data: { name: input.name, description: input.description, leadId: input.leadId },
    select: { id: true, key: true, name: true },
  });
}

export async function deleteProject(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  confirmKey: string;
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "projects:delete");
  const project = await db.project.findUniqueOrThrow({
    where: { id: input.projectId, workspaceId: input.workspaceId },
    select: { key: true, issues: { select: { attachments: { select: { storageKey: true } } } } },
  });
  if (project.key !== input.confirmKey.trim().toUpperCase()) {
    throw new AppError("validation_failed", "Type the project key exactly to confirm", {
      field: "confirmKey",
    });
  }
  await db.project.delete({ where: { id: input.projectId } });
  return project.issues.flatMap((issue) => issue.attachments.map((a) => a.storageKey));
}

export async function createLabel(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  name: string;
  color: LabelColor;
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "issues:update");
  try {
    return await db.label.create({
      data: { projectId: input.projectId, name: input.name, color: input.color },
      select: { id: true, name: true, color: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("conflict", `A label called "${input.name}" already exists`, {
        field: "name",
      });
    }
    throw error;
  }
}
