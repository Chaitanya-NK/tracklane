import "server-only";
import { AppError, can } from "@tracklane/core";
import { db } from "@tracklane/db";
import { getWorkspaceAccess } from "@/server/authz";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Time off overlapping [from, to] (all upcoming when `to` is omitted). */
export async function listTimeOff(workspaceId: string, from: Date, to?: Date) {
  const rows = await db.timeOff.findMany({
    where: { workspaceId, endDate: { gte: from }, ...(to ? { startDate: { lte: to } } : {}) },
    orderBy: { startDate: "asc" },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      note: true,
      user: { select: { id: true, name: true, image: true } },
    },
  });
  return rows.map((r) => ({ ...r, startDate: iso(r.startDate), endDate: iso(r.endDate) }));
}

export type TimeOffItem = Awaited<ReturnType<typeof listTimeOff>>[number];

/** People add their own time off; admins add anyone's. */
export async function addTimeOff(input: {
  slug: string;
  actorId: string;
  userId: string;
  startDate: string;
  endDate: string;
  note: string;
}) {
  const { workspace, role } = await getWorkspaceAccess(input.slug);
  if (input.userId !== input.actorId && !can(role, "members:update_role")) {
    throw new AppError("forbidden", "Only admins can add time off for someone else");
  }
  if (input.endDate < input.startDate) {
    throw new AppError("validation_failed", "The end date must be on or after the start");
  }
  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: input.userId } },
    select: { userId: true },
  });
  if (!member) throw new AppError("not_found", "Member not found");
  return db.timeOff.create({
    data: {
      workspaceId: workspace.id,
      userId: input.userId,
      startDate: new Date(`${input.startDate}T00:00:00Z`),
      endDate: new Date(`${input.endDate}T00:00:00Z`),
      note: input.note,
    },
    select: { id: true },
  });
}

export async function removeTimeOff(input: { slug: string; actorId: string; id: string }) {
  const { workspace, role } = await getWorkspaceAccess(input.slug);
  const row = await db.timeOff.findFirst({
    where: { id: input.id, workspaceId: workspace.id },
    select: { userId: true },
  });
  if (!row) throw new AppError("not_found", "Time off not found");
  if (row.userId !== input.actorId && !can(role, "members:update_role")) {
    throw new AppError("forbidden", "Only admins can remove someone else's time off");
  }
  await db.timeOff.delete({ where: { id: input.id } });
}
