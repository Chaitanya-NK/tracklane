import "server-only";
import { AppError, can, formatIssueKey } from "@tracklane/core";
import { db } from "@tracklane/db";
import { updateIssue } from "@/features/issues/server/service";
import { assertWorkspacePermission } from "@/server/authz";
import { publishRoomChanged } from "@/server/realtime/publish";
import { DECKS, type DeckName, isNumericCard } from "../deck";

const MAX_QUEUE = 50;

export function listPokerSessions(workspaceId: string) {
  return db.pokerSession.findMany({
    where: { workspaceId },
    orderBy: [{ endedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      queue: true,
      endedAt: true,
      createdAt: true,
      project: { select: { key: true, name: true } },
      createdBy: { select: { name: true } },
    },
  });
}

/** Open, unestimated stories, tasks and bugs: what a session usually estimates. */
export async function listPokerCandidates(workspaceId: string) {
  const projects = await db.project.findMany({
    where: { workspaceId, archivedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      key: true,
      issues: {
        where: {
          estimate: null,
          type: { in: ["story", "task", "bug"] },
          status: { category: { not: "done" } },
        },
        orderBy: [{ sprintId: { sort: "asc", nulls: "last" } }, { position: "asc" }],
        take: 40,
        select: { id: true, number: true, title: true, type: true },
      },
    },
  });
  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    issues: p.issues.map((i) => ({
      id: i.id,
      key: formatIssueKey(p.key, i.number),
      title: i.title,
      type: i.type,
    })),
  }));
}

/**
 * The session as one person sees it: before the reveal, everyone can see who has voted but
 * only their own card.
 */
export async function getPokerSession(workspaceId: string, sessionId: string, viewerId: string) {
  const session = await db.pokerSession.findFirst({
    where: { id: sessionId, workspaceId },
    select: {
      id: true,
      name: true,
      deck: true,
      queue: true,
      currentIssueId: true,
      revealed: true,
      endedAt: true,
      createdById: true,
      projectId: true,
      project: { select: { key: true, name: true } },
    },
  });
  if (!session) return null;
  const [issues, votes] = await Promise.all([
    db.issue.findMany({
      where: { id: { in: session.queue }, projectId: session.projectId },
      select: {
        id: true,
        number: true,
        title: true,
        type: true,
        description: true,
        estimate: true,
        status: { select: { name: true, category: true } },
        customType: { select: { name: true, color: true, icon: true } },
      },
    }),
    session.currentIssueId
      ? db.pokerVote.findMany({
          where: { sessionId, issueId: session.currentIssueId },
          orderBy: { createdAt: "asc" },
          select: { value: true, user: { select: { id: true, name: true, image: true } } },
        })
      : [],
  ]);
  const byId = new Map(issues.map((i) => [i.id, i]));
  const queue = session.queue
    .map((id) => byId.get(id))
    .filter((i) => i !== undefined)
    .map((i) => ({ ...i, key: formatIssueKey(session.project.key, i.number) }));
  return {
    ...session,
    queue,
    current: queue.find((i) => i.id === session.currentIssueId) ?? null,
    votes: votes.map((v) => ({
      user: v.user,
      value: session.revealed || v.user.id === viewerId ? v.value : null,
    })),
    myVote: votes.find((v) => v.user.id === viewerId)?.value ?? null,
  };
}

export type PokerView = NonNullable<Awaited<ReturnType<typeof getPokerSession>>>;

export async function createPokerSession(input: {
  workspaceId: string;
  userId: string;
  projectId: string;
  name: string;
  deck: DeckName;
  issueIds: string[];
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "issues:update");
  const issues = await db.issue.findMany({
    where: {
      id: { in: input.issueIds.slice(0, MAX_QUEUE) },
      projectId: input.projectId,
      workspaceId: input.workspaceId,
    },
    select: { id: true },
  });
  if (!issues.length)
    throw new AppError("validation_failed", "Pick at least one issue from the project");
  const found = new Set(issues.map((i) => i.id));
  const queue = input.issueIds.filter((id) => found.has(id));
  return db.pokerSession.create({
    data: {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      name: input.name,
      deck: [...DECKS[input.deck].cards],
      queue,
      currentIssueId: queue[0],
      createdById: input.userId,
    },
    select: { id: true, name: true },
  });
}

async function session(
  workspaceId: string,
  userId: string,
  sessionId: string,
  facilitate: boolean,
) {
  const role = await assertWorkspacePermission(workspaceId, userId, "issues:update");
  const s = await db.pokerSession.findFirst({
    where: { id: sessionId, workspaceId },
    select: {
      id: true,
      deck: true,
      queue: true,
      currentIssueId: true,
      revealed: true,
      endedAt: true,
      createdById: true,
      projectId: true,
    },
  });
  if (!s) throw new AppError("not_found", "Session not found");
  if (s.endedAt) throw new AppError("conflict", "This session has ended");
  if (facilitate && s.createdById !== userId && !can(role, "projects:update")) {
    throw new AppError("forbidden", "Only the facilitator or an admin can do that");
  }
  return s;
}

const changed = (workspaceId: string, sessionId: string, userId: string) =>
  db.$transaction((tx) => publishRoomChanged(tx, workspaceId, "poker", sessionId, userId));

export async function castPokerVote(
  workspaceId: string,
  userId: string,
  sessionId: string,
  value: string,
) {
  const s = await session(workspaceId, userId, sessionId, false);
  if (!s.currentIssueId) throw new AppError("conflict", "Nothing is being estimated");
  if (s.revealed) throw new AppError("conflict", "Votes are already revealed. Wait for a re-vote.");
  if (!s.deck.includes(value))
    throw new AppError("validation_failed", "That card isn't in this deck");
  await db.pokerVote.upsert({
    where: { sessionId_issueId_userId: { sessionId, issueId: s.currentIssueId, userId } },
    create: { sessionId, issueId: s.currentIssueId, userId, value },
    update: { value },
  });
  await changed(workspaceId, sessionId, userId);
}

export async function revealPokerVotes(
  workspaceId: string,
  userId: string,
  sessionId: string,
  revealed: boolean,
) {
  const s = await session(workspaceId, userId, sessionId, true);
  await db.$transaction(async (tx) => {
    // Hiding again starts a fresh round.
    if (!revealed && s.currentIssueId) {
      await tx.pokerVote.deleteMany({ where: { sessionId, issueId: s.currentIssueId } });
    }
    await tx.pokerSession.update({ where: { id: sessionId }, data: { revealed } });
    await publishRoomChanged(tx, workspaceId, "poker", sessionId, userId);
  });
}

export async function selectPokerIssue(
  workspaceId: string,
  userId: string,
  sessionId: string,
  issueId: string,
) {
  const s = await session(workspaceId, userId, sessionId, true);
  if (!s.queue.includes(issueId))
    throw new AppError("validation_failed", "That issue isn't in this session");
  await db.$transaction(async (tx) => {
    await tx.pokerSession.update({
      where: { id: sessionId },
      data: { currentIssueId: issueId, revealed: false },
    });
    await publishRoomChanged(tx, workspaceId, "poker", sessionId, userId);
  });
}

/** Saves the agreed estimate on the issue, then moves to the next issue without one. */
export async function acceptPokerEstimate(
  workspaceId: string,
  userId: string,
  sessionId: string,
  value: string,
) {
  const s = await session(workspaceId, userId, sessionId, true);
  if (!s.currentIssueId) throw new AppError("conflict", "Nothing is being estimated");
  if (!isNumericCard(value)) throw new AppError("validation_failed", "Pick a number");
  await updateIssue({ issueId: s.currentIssueId, userId, patch: { estimate: Number(value) } });
  const remaining = await db.issue.findMany({
    where: { id: { in: s.queue }, estimate: null },
    select: { id: true },
  });
  const open = new Set(remaining.map((r) => r.id));
  const at = s.queue.indexOf(s.currentIssueId);
  const next =
    [...s.queue.slice(at + 1), ...s.queue.slice(0, at)].find((id) => open.has(id)) ?? null;
  await db.$transaction(async (tx) => {
    await tx.pokerSession.update({
      where: { id: sessionId },
      data: { currentIssueId: next, revealed: false },
    });
    await publishRoomChanged(tx, workspaceId, "poker", sessionId, userId);
  });
  return { next };
}

export async function addPokerIssues(
  workspaceId: string,
  userId: string,
  sessionId: string,
  keys: string[],
) {
  const s = await session(workspaceId, userId, sessionId, true);
  const project = await db.project.findUniqueOrThrow({
    where: { id: s.projectId },
    select: { key: true },
  });
  const numbers = keys
    .map((k) => k.trim().toUpperCase())
    .filter(Boolean)
    .map((k) => {
      const m = /^([A-Z][A-Z0-9]*)-(\d+)$/.exec(k);
      if (!m || m[1] !== project.key)
        throw new AppError("validation_failed", `${k} isn't an issue in ${project.key}`);
      return Number(m[2]);
    });
  const issues = await db.issue.findMany({
    where: { projectId: s.projectId, number: { in: numbers } },
    select: { id: true },
  });
  const queue = [...new Set([...s.queue, ...issues.map((i) => i.id)])].slice(0, MAX_QUEUE);
  await db.$transaction(async (tx) => {
    await tx.pokerSession.update({
      where: { id: sessionId },
      data: { queue, currentIssueId: s.currentIssueId ?? issues[0]?.id ?? null },
    });
    await publishRoomChanged(tx, workspaceId, "poker", sessionId, userId);
  });
  return queue.length - s.queue.length;
}

export async function endPokerSession(workspaceId: string, userId: string, sessionId: string) {
  await session(workspaceId, userId, sessionId, true);
  await db.$transaction(async (tx) => {
    await tx.pokerSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date(), currentIssueId: null },
    });
    await publishRoomChanged(tx, workspaceId, "poker", sessionId, userId);
  });
}
