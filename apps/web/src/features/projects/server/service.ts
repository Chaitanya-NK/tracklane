import "server-only";
import { audit } from "@/server/audit";
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
    const project = await db.project.create({
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
    await audit(db, {
      workspaceId: input.workspaceId,
      actor: { id: input.userId },
      action: "project.created",
      target: { type: "project", id: project.id, label: `${project.key} · ${project.name}` },
      metadata: { type: input.type },
    });
    return project;
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
  const project = await db.project.update({
    where: { id: input.projectId, workspaceId: input.workspaceId },
    data: { name: input.name, description: input.description, leadId: input.leadId },
    select: { id: true, key: true, name: true },
  });
  await audit(db, {
    workspaceId: input.workspaceId,
    actor: { id: input.userId },
    action: "project.updated",
    target: { type: "project", id: project.id, label: `${project.key} · ${project.name}` },
    metadata: { leadId: input.leadId },
  });
  return project;
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
    select: {
      key: true,
      name: true,
      issues: { select: { attachments: { select: { storageKey: true } } } },
    },
  });
  if (project.key !== input.confirmKey.trim().toUpperCase()) {
    throw new AppError("validation_failed", "Type the project key exactly to confirm", {
      field: "confirmKey",
    });
  }
  await db.project.delete({ where: { id: input.projectId } });
  await audit(db, {
    workspaceId: input.workspaceId,
    actor: { id: input.userId },
    action: "project.deleted",
    target: { type: "project", id: input.projectId, label: `${project.key} · ${project.name}` },
    metadata: { issues: project.issues.length },
  });
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

async function labelInWorkspace(labelId: string, workspaceId: string) {
  const label = await db.label.findFirst({
    where: { id: labelId, project: { workspaceId } },
    select: { id: true, projectId: true, name: true },
  });
  if (!label) throw new AppError("not_found", "Label not found");
  return label;
}

export async function updateLabel(input: {
  workspaceId: string;
  labelId: string;
  userId: string;
  name: string;
  color: LabelColor;
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "issues:update");
  await labelInWorkspace(input.labelId, input.workspaceId);
  try {
    return await db.label.update({
      where: { id: input.labelId },
      data: { name: input.name, color: input.color },
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

/** Deletes a label and removes it from every issue. Returns how many issues had it. */
export async function deleteLabel(input: { workspaceId: string; labelId: string; userId: string }) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "projects:update");
  const label = await labelInWorkspace(input.labelId, input.workspaceId);
  const used = await db.issueLabel.count({ where: { labelId: label.id } });
  await db.label.delete({ where: { id: label.id } });
  return { name: label.name, used };
}
