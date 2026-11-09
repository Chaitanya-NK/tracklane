import "server-only";
import { AppError } from "@tracklane/core";
import { db } from "@tracklane/db";

export async function listComponents(projectId: string) {
  const components = await db.projectComponent.findMany({
    where: { projectId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      lead: { select: { id: true, name: true, image: true } },
      _count: { select: { issues: true } },
    },
  });
  return components.map(({ _count, ...c }) => ({ ...c, issueCount: _count.issues }));
}

export type ComponentItem = Awaited<ReturnType<typeof listComponents>>[number];

export interface ComponentInput {
  name: string;
  description: string;
  leadId: string | null;
}

async function assertUnique(projectId: string, name: string, exceptId?: string) {
  const clash = await db.projectComponent.findFirst({
    where: {
      projectId,
      name: { equals: name, mode: "insensitive" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw new AppError("conflict", `There's already a component called ${name}`);
}

async function assertLead(workspaceId: string, leadId: string | null) {
  if (!leadId) return;
  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: leadId } },
    select: { userId: true },
  });
  if (!member) throw new AppError("validation_failed", "The lead isn't a workspace member");
}

export async function saveComponent(input: {
  workspaceId: string;
  projectId: string;
  componentId: string | null;
  component: ComponentInput;
}) {
  await assertUnique(input.projectId, input.component.name, input.componentId ?? undefined);
  await assertLead(input.workspaceId, input.component.leadId);
  if (input.componentId) {
    const { count } = await db.projectComponent.updateMany({
      where: { id: input.componentId, projectId: input.projectId },
      data: input.component,
    });
    if (!count) throw new AppError("not_found", "Component not found");
    return { id: input.componentId };
  }
  return db.projectComponent.create({
    data: { projectId: input.projectId, ...input.component },
    select: { id: true },
  });
}

export async function deleteComponent(projectId: string, componentId: string) {
  const { count } = await db.projectComponent.deleteMany({ where: { id: componentId, projectId } });
  if (!count) throw new AppError("not_found", "Component not found");
}
