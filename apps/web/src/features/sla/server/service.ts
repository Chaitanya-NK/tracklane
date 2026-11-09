import "server-only";
import { AppError } from "@tracklane/core";
import { db, Prisma } from "@tracklane/db";
import { tqlWhere } from "@/features/search/server";
import { assertWorkspacePermission } from "@/server/authz";

export interface SlaPolicyInput {
  name: string;
  query: string;
  metric: "first_response" | "resolution";
  targetMinutes: number;
  warnMinutes: number;
}

export function listSlaPolicies(projectId: string) {
  return db.slaPolicy.findMany({
    where: { projectId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      query: true,
      metric: true,
      targetMinutes: true,
      warnMinutes: true,
    },
  });
}

async function check(
  workspaceId: string,
  projectId: string,
  userId: string,
  input: SlaPolicyInput,
) {
  await assertWorkspacePermission(workspaceId, userId, "projects:update");
  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true },
  });
  if (!project) throw new AppError("not_found", "Project not found");
  if (input.targetMinutes < 1)
    throw new AppError("validation_failed", "Set a target", { field: "target" });
  if (input.warnMinutes >= input.targetMinutes) {
    throw new AppError("validation_failed", "Warn before the target, not after it", {
      field: "warn",
    });
  }
  if (!input.query.trim())
    throw new AppError("validation_failed", "Write which issues it covers", { field: "query" });
  const result = await tqlWhere({ workspaceId, userId, query: input.query });
  if (!result.ok) throw new AppError("validation_failed", result.message, { field: "query" });
}

function duplicate(error: unknown, name: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new AppError("conflict", `There's already an SLA called ${name}`, { field: "name" });
  }
  throw error;
}

export async function createSlaPolicy(
  workspaceId: string,
  projectId: string,
  userId: string,
  input: SlaPolicyInput,
) {
  await check(workspaceId, projectId, userId, input);
  const position = await db.slaPolicy.count({ where: { projectId } });
  return db.slaPolicy
    .create({ data: { projectId, position, ...input }, select: { id: true, name: true } })
    .catch((error) => duplicate(error, input.name));
}

export async function updateSlaPolicy(
  workspaceId: string,
  projectId: string,
  userId: string,
  policyId: string,
  input: SlaPolicyInput,
) {
  await check(workspaceId, projectId, userId, input);
  const { count } = await db.slaPolicy
    .updateMany({ where: { id: policyId, projectId }, data: input })
    .catch((error) => duplicate(error, input.name));
  if (!count) throw new AppError("not_found", "SLA not found");
  // Changed targets get fresh warnings.
  await db.slaNotice.deleteMany({ where: { policyId } });
  return { id: policyId, name: input.name };
}

export async function deleteSlaPolicy(
  workspaceId: string,
  projectId: string,
  userId: string,
  policyId: string,
) {
  await assertWorkspacePermission(workspaceId, userId, "projects:update");
  const { count } = await db.slaPolicy.deleteMany({
    where: { id: policyId, project: { id: projectId, workspaceId } },
  });
  if (!count) throw new AppError("not_found", "SLA not found");
}
