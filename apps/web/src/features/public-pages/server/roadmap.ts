import "server-only";
import { AppError } from "@tracklane/core";
import { db } from "@tracklane/db";
import { releaseShippedEmail, sendEmail } from "@tracklane/email";
import { env } from "@/env";

async function publicProject(workspaceSlug: string, projectKey: string) {
  const project = await db.project.findFirst({
    where: {
      key: projectKey.toUpperCase(),
      roadmapPublic: true,
      archivedAt: null,
      workspace: { slug: workspaceSlug },
    },
    select: { id: true },
  });
  if (!project) throw new AppError("not_found", "Roadmap not found");
  return project;
}

/** Vote counts for roadmap epics, and which ones this voter has voted for. */
export async function roadmapVotes(issueIds: string[], voterKey: string | null) {
  const [counts, mine] = await Promise.all([
    db.roadmapVote.groupBy({
      by: ["issueId"],
      where: { issueId: { in: issueIds } },
      _count: { _all: true },
    }),
    voterKey
      ? db.roadmapVote.findMany({
          where: { issueId: { in: issueIds }, voterKey },
          select: { issueId: true },
        })
      : Promise.resolve([]),
  ]);
  return {
    counts: new Map(counts.map((c) => [c.issueId, c._count._all])),
    mine: new Set(mine.map((m) => m.issueId)),
  };
}

/** Adds or removes an upvote on a public roadmap epic. */
export async function toggleVote(input: {
  workspaceSlug: string;
  projectKey: string;
  issueId: string;
  voterKey: string;
}) {
  const project = await publicProject(input.workspaceSlug, input.projectKey);
  const epic = await db.issue.findFirst({
    where: { id: input.issueId, projectId: project.id, type: "epic" },
    select: { id: true },
  });
  if (!epic) throw new AppError("not_found", "Item not found");
  const key = { issueId: epic.id, voterKey: input.voterKey };
  const removed = await db.roadmapVote.deleteMany({ where: key });
  if (!removed.count) await db.roadmapVote.create({ data: key });
  return { voted: removed.count === 0 };
}

export async function subscribeToRoadmap(input: {
  workspaceSlug: string;
  projectKey: string;
  email: string;
}) {
  const project = await publicProject(input.workspaceSlug, input.projectKey);
  const email = input.email.trim().toLowerCase();
  await db.roadmapSubscriber.upsert({
    where: { projectId_email: { projectId: project.id, email } },
    create: { projectId: project.id, email },
    update: {},
  });
}

/** Released versions with what shipped in them, newest first. */
export async function getChangelog(projectId: string) {
  const releases = await db.release.findMany({
    where: { projectId, status: "released" },
    orderBy: { releasedAt: "desc" },
    take: 8,
    select: {
      id: true,
      name: true,
      description: true,
      releasedAt: true,
      issues: {
        where: { status: { category: "done" } },
        orderBy: { number: "asc" },
        take: 6,
        select: { title: true },
      },
    },
  });
  return releases.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    releasedAt: r.releasedAt,
    items: r.issues.map((i) => i.title),
  }));
}

/** Emails roadmap subscribers about a shipped release (public roadmaps only). */
export async function notifyRoadmapSubscribers(releaseId: string) {
  const release = await db.release.findUnique({
    where: { id: releaseId },
    select: {
      name: true,
      description: true,
      project: {
        select: {
          key: true,
          name: true,
          roadmapPublic: true,
          workspace: { select: { slug: true } },
          roadmapSubscribers: { select: { email: true }, take: 1000 },
        },
      },
      issues: { where: { status: { category: "done" } }, take: 10, select: { title: true } },
    },
  });
  if (!release?.project.roadmapPublic) return 0;
  const email = releaseShippedEmail({
    projectName: release.project.name,
    releaseName: release.name,
    description: release.description,
    items: release.issues.map((i) => i.title),
    roadmapUrl: `${env.NEXT_PUBLIC_APP_URL}/roadmap/${release.project.workspace.slug}/${release.project.key}`,
  });
  let sent = 0;
  for (const s of release.project.roadmapSubscribers) {
    try {
      await sendEmail(s.email, email);
      sent++;
    } catch {
      // One bad address or a mail outage shouldn't stop the rest.
    }
  }
  return sent;
}
