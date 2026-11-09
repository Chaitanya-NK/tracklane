import "server-only";
import { AppError } from "@tracklane/core";
import { db } from "@tracklane/db";

/** Default readiness steps for a new checklist. */
export const DEFAULT_CHECKLIST = [
  "QA signed off",
  "Release notes reviewed",
  "Rollback plan written",
  "Stakeholders told",
];

export async function listChecklist(releaseId: string) {
  return db.releaseChecklistItem.findMany({
    where: { releaseId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, text: true, done: true },
  });
}

export type ChecklistItem = Awaited<ReturnType<typeof listChecklist>>[number];

/** Checklist progress per release, for the releases list. */
export async function checklistCounts(releaseIds: string[]) {
  const rows = await db.releaseChecklistItem.groupBy({
    by: ["releaseId", "done"],
    where: { releaseId: { in: releaseIds } },
    _count: { _all: true },
  });
  const out = new Map<string, { done: number; total: number }>();
  for (const r of rows) {
    const c = out.get(r.releaseId) ?? { done: 0, total: 0 };
    c.total += r._count._all;
    if (r.done) c.done += r._count._all;
    out.set(r.releaseId, c);
  }
  return out;
}

async function inProject(projectId: string, releaseId: string) {
  const release = await db.release.findFirst({
    where: { id: releaseId, projectId },
    select: { id: true },
  });
  if (!release) throw new AppError("not_found", "Release not found");
}

export async function addChecklistItems(projectId: string, releaseId: string, texts: string[]) {
  await inProject(projectId, releaseId);
  const count = await db.releaseChecklistItem.count({ where: { releaseId } });
  if (count + texts.length > 30) throw new AppError("validation_failed", "Up to 30 steps");
  await db.releaseChecklistItem.createMany({
    data: texts.map((text, i) => ({ releaseId, text, position: count + i })),
  });
}

export async function setChecklistItem(
  projectId: string,
  itemId: string,
  patch: { done?: boolean; remove?: boolean },
) {
  const item = await db.releaseChecklistItem.findFirst({
    where: { id: itemId, release: { projectId } },
    select: { id: true },
  });
  if (!item) throw new AppError("not_found", "Checklist step not found");
  if (patch.remove) await db.releaseChecklistItem.delete({ where: { id: item.id } });
  else await db.releaseChecklistItem.update({ where: { id: item.id }, data: { done: patch.done } });
}
