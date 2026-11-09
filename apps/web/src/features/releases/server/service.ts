import "server-only";
import { after } from "next/server";
import { notifyRoadmapSubscribers } from "@/features/public-pages/server/roadmap";
import { AppError, formatIssueKey, releaseNotes } from "@tracklane/core";
import { db, Prisma } from "@tracklane/db";
import { issueListSelect } from "@/features/issues/server";
import { assertWorkspacePermission } from "@/server/authz";
import { publish, rooms } from "@/server/realtime/publish";
import { enqueueWebhooks } from "@/server/webhooks/enqueue";

const day = (value: string | null) => (value ? new Date(`${value}T00:00:00Z`) : null);
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Releases with issue counts by status category, newest unreleased first. */
export async function listReleases(projectId: string, includeArchived: boolean) {
  const [releases, counts] = await Promise.all([
    db.release.findMany({
      where: { projectId, ...(includeArchived ? {} : { status: { not: "archived" } }) },
      orderBy: [
        { status: "asc" },
        { releaseDate: { sort: "asc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        startDate: true,
        releaseDate: true,
        releasedAt: true,
      },
    }),
    db.$queryRaw<{ release_id: string; category: string; n: bigint }[]>`
      select i.release_id, s.category::text as category, count(*) as n
      from issues i join workflow_statuses s on s.id = i.status_id
      where i.project_id = ${projectId} and i.release_id is not null
      group by i.release_id, s.category`,
  ]);
  return releases.map((r) => {
    const mine = counts.filter((c) => c.release_id === r.id);
    const of = (category: string) => Number(mine.find((c) => c.category === category)?.n ?? 0);
    return {
      ...r,
      startDate: iso(r.startDate),
      releaseDate: iso(r.releaseDate),
      counts: { todo: of("todo"), in_progress: of("in_progress"), done: of("done") },
    };
  });
}

export type ReleaseItem = Awaited<ReturnType<typeof listReleases>>[number];

export async function getRelease(projectId: string, releaseId: string) {
  const release = await db.release.findFirst({
    where: { id: releaseId, projectId },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      startDate: true,
      releaseDate: true,
      releasedAt: true,
      project: { select: { key: true, name: true } },
    },
  });
  if (!release) return null;
  const issues = await db.issue.findMany({
    where: { releaseId },
    orderBy: [{ status: { category: "desc" } }, { number: "asc" }],
    select: issueListSelect,
  });
  const notes = releaseNotes({
    projectName: release.project.name,
    release: {
      name: release.name,
      description: release.description,
      // Only a shipped release has a release date in its notes.
      releaseDate: iso(release.releasedAt),
    },
    issues: issues.map((i) => ({
      key: formatIssueKey(i.project.key, i.number),
      title: i.title,
      type: i.type,
      done: i.status.category === "done",
    })),
  });
  return {
    release: {
      ...release,
      startDate: iso(release.startDate),
      releaseDate: iso(release.releaseDate),
    },
    issues,
    notes,
  };
}

export interface ReleaseInput {
  name: string;
  description: string;
  startDate: string | null;
  releaseDate: string | null;
}

async function access(workspaceId: string, projectId: string, userId: string) {
  await assertWorkspacePermission(workspaceId, userId, "projects:update");
  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true },
  });
  if (!project) throw new AppError("not_found", "Project not found");
}

function duplicate(error: unknown, name: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new AppError("conflict", `There's already a release called ${name}`, { field: "name" });
  }
  throw error;
}

export async function saveRelease(
  workspaceId: string,
  projectId: string,
  userId: string,
  releaseId: string | null,
  input: ReleaseInput,
) {
  await access(workspaceId, projectId, userId);
  if (input.startDate && input.releaseDate && input.startDate > input.releaseDate) {
    throw new AppError("validation_failed", "The release date is before the start date", {
      field: "releaseDate",
    });
  }
  const data = {
    name: input.name,
    description: input.description,
    startDate: day(input.startDate),
    releaseDate: day(input.releaseDate),
  };
  if (releaseId) {
    const found = await db.release.findFirst({
      where: { id: releaseId, projectId },
      select: { id: true },
    });
    if (!found) throw new AppError("not_found", "Release not found");
    return db.release
      .update({ where: { id: releaseId }, data, select: { id: true, name: true } })
      .catch((e: unknown) => duplicate(e, input.name));
  }
  return db.release
    .create({ data: { ...data, projectId }, select: { id: true, name: true } })
    .catch((e: unknown) => duplicate(e, input.name));
}

/**
 * Marks a release as shipped. Its open issues move to `moveOpenTo` (another unreleased
 * release) or lose their fix version.
 */
export async function shipRelease(
  workspaceId: string,
  projectId: string,
  userId: string,
  releaseId: string,
  moveOpenTo: string | null,
) {
  await access(workspaceId, projectId, userId);
  const release = await db.release.findFirst({
    where: { id: releaseId, projectId },
    select: { status: true, name: true },
  });
  if (!release) throw new AppError("not_found", "Release not found");
  if (release.status !== "unreleased")
    throw new AppError("conflict", `${release.name} is already released`);
  if (moveOpenTo) {
    const target = await db.release.findFirst({
      where: { id: moveOpenTo, projectId, status: "unreleased", NOT: { id: releaseId } },
      select: { id: true },
    });
    if (!target)
      throw new AppError("validation_failed", "Move open issues to another unreleased version");
  }
  return db.$transaction(async (tx) => {
    const moved = await tx.issue.updateMany({
      where: { releaseId, status: { category: { not: "done" } } },
      data: { releaseId: moveOpenTo },
    });
    const shipped = await tx.release.update({
      where: { id: releaseId },
      data: { status: "released", releasedAt: new Date() },
      select: {
        id: true,
        name: true,
        description: true,
        releasedAt: true,
        project: { select: { id: true, key: true } },
      },
    });
    await enqueueWebhooks(tx, workspaceId, "release.released", {
      release: { ...shipped, releasedAt: shipped.releasedAt?.toISOString() ?? null },
      movedOpenIssues: moved.count,
    });
    await publish(tx, {
      rooms: [rooms.project(workspaceId, projectId)],
      event: "issue:changed",
      data: { issueId: null, actorId: userId },
    });
    after(() => notifyRoadmapSubscribers(releaseId).catch(() => 0));
    return { moved: moved.count };
  });
}

export async function setReleaseStatus(
  workspaceId: string,
  projectId: string,
  userId: string,
  releaseId: string,
  status: "unreleased" | "archived" | "released",
) {
  await access(workspaceId, projectId, userId);
  const found = await db.release.findFirst({
    where: { id: releaseId, projectId },
    select: { releasedAt: true },
  });
  if (!found) throw new AppError("not_found", "Release not found");
  await db.release.update({
    where: { id: releaseId },
    data: {
      status,
      // Archived keeps its ship date; unreleasing clears it.
      releasedAt: status === "unreleased" ? null : found.releasedAt,
    },
  });
}

/** Issues keep existing; they just lose this fix version. */
export async function deleteRelease(
  workspaceId: string,
  projectId: string,
  userId: string,
  releaseId: string,
) {
  await access(workspaceId, projectId, userId);
  const { count } = await db.release.deleteMany({ where: { id: releaseId, projectId } });
  if (!count) throw new AppError("not_found", "Release not found");
}
