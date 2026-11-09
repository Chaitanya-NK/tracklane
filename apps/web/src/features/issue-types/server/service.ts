import "server-only";
import { AppError, ISSUE_TYPES, type IssueType } from "@tracklane/core";
import { db, Prisma } from "@tracklane/db";
import { assertWorkspacePermission } from "@/server/authz";

export async function listIssueTypes(projectId: string) {
  const rows = await db.projectIssueType.findMany({
    where: { projectId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      baseType: true,
      color: true,
      icon: true,
      _count: { select: { issues: true } },
    },
  });
  return rows.map(({ _count, ...r }) => ({ ...r, issueCount: _count.issues }));
}

export type IssueTypeItem = Awaited<ReturnType<typeof listIssueTypes>>[number];

export interface IssueTypeInput {
  name: string;
  baseType: IssueType;
  color: string;
  icon: string;
}

async function project(workspaceId: string, projectId: string, userId: string) {
  await assertWorkspacePermission(workspaceId, userId, "projects:update");
  const found = await db.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true },
  });
  if (!found) throw new AppError("not_found", "Project not found");
}

function duplicate(error: unknown, name: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new AppError("conflict", `There's already a type called ${name}`, { field: "name" });
  }
  throw error;
}

export async function saveIssueType(
  workspaceId: string,
  projectId: string,
  userId: string,
  id: string | null,
  input: IssueTypeInput,
) {
  await project(workspaceId, projectId, userId);
  if ((ISSUE_TYPES as readonly string[]).includes(input.name.toLowerCase())) {
    throw new AppError("validation_failed", `${input.name} is a built-in type`, { field: "name" });
  }
  if (id) {
    const existing = await db.projectIssueType.findFirst({
      where: { id, projectId },
      select: { baseType: true },
    });
    if (!existing) throw new AppError("not_found", "Issue type not found");
    // The base type decides hierarchy and board behaviour; changing it would strand issues.
    if (existing.baseType !== input.baseType) {
      throw new AppError("validation_failed", "The base type can't be changed", {
        field: "baseType",
      });
    }
    return db.projectIssueType
      .update({
        where: { id },
        data: { name: input.name, color: input.color, icon: input.icon },
        select: { id: true, name: true },
      })
      .catch((e: unknown) => duplicate(e, input.name));
  }
  const count = await db.projectIssueType.count({ where: { projectId } });
  if (count >= 30) throw new AppError("conflict", "A project can have at most 30 issue types");
  return db.projectIssueType
    .create({ data: { ...input, projectId, position: count }, select: { id: true, name: true } })
    .catch((e: unknown) => duplicate(e, input.name));
}

/** Issues of a deleted type keep their base type. */
export async function deleteIssueType(
  workspaceId: string,
  projectId: string,
  userId: string,
  id: string,
) {
  await project(workspaceId, projectId, userId);
  const { count } = await db.projectIssueType.deleteMany({ where: { id, projectId } });
  if (!count) throw new AppError("not_found", "Issue type not found");
}
