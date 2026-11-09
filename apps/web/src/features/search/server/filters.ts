import "server-only";
import { AppError, can, parseTql, type WorkspaceRole } from "@tracklane/core";
import { db } from "@tracklane/db";
import { assertWorkspacePermission } from "@/server/authz";
import { loadTqlEnvironment } from "./environment";

const filterSelect = {
  id: true,
  name: true,
  description: true,
  query: true,
  shared: true,
  ownerId: true,
  updatedAt: true,
  owner: { select: { name: true } },
} as const;

/** Filters the user can see: their own plus shared ones, starred first. */
export async function listFilters(workspaceId: string, userId: string) {
  const [filters, favorites] = await Promise.all([
    db.savedFilter.findMany({
      where: { workspaceId, OR: [{ ownerId: userId }, { shared: true }] },
      orderBy: { name: "asc" },
      select: filterSelect,
    }),
    db.filterFavorite.findMany({
      where: { userId, filter: { workspaceId } },
      select: { filterId: true },
    }),
  ]);
  const starred = new Set(favorites.map((f) => f.filterId));
  return filters
    .map((f) => ({ ...f, starred: starred.has(f.id), mine: f.ownerId === userId }))
    .sort((a, b) => Number(b.starred) - Number(a.starred));
}

export type SavedFilterItem = Awaited<ReturnType<typeof listFilters>>[number];

export async function getFilter(workspaceId: string, userId: string, filterId: string) {
  return db.savedFilter.findFirst({
    where: { id: filterId, workspaceId, OR: [{ ownerId: userId }, { shared: true }] },
    select: filterSelect,
  });
}

async function assertValidQuery(workspaceId: string, userId: string, query: string) {
  const env = await loadTqlEnvironment(workspaceId, userId);
  const parsed = parseTql(query, env.parseOptions);
  if (!parsed.ok)
    throw new AppError("validation_failed", `The query has an error: ${parsed.error.message}`, {
      field: "query",
    });
}

export async function createFilter(input: {
  workspaceId: string;
  userId: string;
  name: string;
  description: string;
  query: string;
  shared: boolean;
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "projects:read");
  await assertValidQuery(input.workspaceId, input.userId, input.query);
  return db.savedFilter.create({
    data: {
      workspaceId: input.workspaceId,
      ownerId: input.userId,
      name: input.name,
      description: input.description,
      query: input.query,
      shared: input.shared,
      favorites: { create: { userId: input.userId } },
    },
    select: { id: true, name: true },
  });
}

/** Owners edit their filters; admins can also edit or delete shared ones. */
async function assertCanManage(filterId: string, userId: string, role: WorkspaceRole) {
  const filter = await db.savedFilter.findUnique({
    where: { id: filterId },
    select: { ownerId: true, shared: true, workspaceId: true },
  });
  if (!filter) throw new AppError("not_found", "Filter not found");
  if (filter.ownerId !== userId && !(filter.shared && can(role, "workspace:update"))) {
    throw new AppError(
      "forbidden",
      "Only the owner (or an admin, for shared filters) can change this filter",
    );
  }
  return filter;
}

export async function updateFilter(input: {
  filterId: string;
  userId: string;
  role: WorkspaceRole;
  name: string;
  description: string;
  query: string;
  shared: boolean;
}) {
  const filter = await assertCanManage(input.filterId, input.userId, input.role);
  await assertValidQuery(filter.workspaceId, input.userId, input.query);
  return db.savedFilter.update({
    where: { id: input.filterId },
    data: {
      name: input.name,
      description: input.description,
      query: input.query,
      shared: input.shared,
    },
    select: { id: true, name: true },
  });
}

export async function deleteFilter(input: {
  filterId: string;
  userId: string;
  role: WorkspaceRole;
}) {
  await assertCanManage(input.filterId, input.userId, input.role);
  await db.savedFilter.delete({ where: { id: input.filterId } });
}

export async function toggleFavorite(input: {
  filterId: string;
  userId: string;
  workspaceId: string;
}) {
  const filter = await getFilter(input.workspaceId, input.userId, input.filterId);
  if (!filter) throw new AppError("not_found", "Filter not found");
  const key = { filterId_userId: { filterId: input.filterId, userId: input.userId } };
  const existing = await db.filterFavorite.findUnique({ where: key });
  if (existing) await db.filterFavorite.delete({ where: key });
  else await db.filterFavorite.create({ data: { filterId: input.filterId, userId: input.userId } });
  return { starred: !existing };
}

/** The user's digest subscription to a filter, if any. */
export async function getSubscription(filterId: string, userId: string) {
  return db.filterSubscription.findUnique({
    where: { filterId_userId: { filterId, userId } },
    select: { frequency: true, lastSentAt: true },
  });
}

/** Subscribes the user to a visible filter's email digest, or unsubscribes (frequency null). */
export async function setSubscription(input: {
  workspaceId: string;
  userId: string;
  filterId: string;
  frequency: "daily" | "weekly" | null;
}) {
  const filter = await getFilter(input.workspaceId, input.userId, input.filterId);
  if (!filter) throw new AppError("not_found", "Filter not found");
  const where = { filterId_userId: { filterId: filter.id, userId: input.userId } };
  if (!input.frequency) {
    await db.filterSubscription.deleteMany({ where: where.filterId_userId });
    return null;
  }
  return db.filterSubscription.upsert({
    where,
    create: { filterId: filter.id, userId: input.userId, frequency: input.frequency },
    update: { frequency: input.frequency },
    select: { frequency: true },
  });
}
