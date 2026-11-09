import "server-only";
import { AppError, can, formatIssueKey } from "@tracklane/core";
import { db } from "@tracklane/db";
import { createIssue } from "@/features/issues/server/service";
import { assertWorkspacePermission } from "@/server/authz";
import { publishRoomChanged } from "@/server/realtime/publish";
import {
  RETRO_TEMPLATES,
  type RetroColumn,
  type RetroPhase,
  type RetroTemplate,
} from "../templates";

export function listRetros(workspaceId: string) {
  return db.retro.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      phase: true,
      createdAt: true,
      project: { select: { key: true, name: true } },
      sprint: { select: { name: true } },
      _count: { select: { cards: true } },
    },
  });
}

/**
 * A retro as one person sees it: while brainstorming, other people's cards are only
 * placeholders; vote totals appear once discussion starts.
 */
export async function getRetro(workspaceId: string, retroId: string, viewerId: string) {
  const retro = await db.retro.findFirst({
    where: { id: retroId, workspaceId },
    select: {
      id: true,
      name: true,
      phase: true,
      columns: true,
      votesPerPerson: true,
      createdById: true,
      projectId: true,
      project: { select: { key: true, name: true } },
      sprint: { select: { name: true } },
      cards: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          columnId: true,
          body: true,
          authorId: true,
          author: { select: { id: true, name: true, image: true } },
          issue: { select: { number: true, project: { select: { key: true } } } },
          votes: { select: { userId: true } },
        },
      },
    },
  });
  if (!retro) return null;
  const hidden = retro.phase === "brainstorm";
  const totals = retro.phase === "discuss" || retro.phase === "closed";
  const cards = retro.cards.map((c) => {
    const mine = c.authorId === viewerId;
    return {
      id: c.id,
      columnId: c.columnId,
      mine,
      body: hidden && !mine ? null : c.body,
      author: hidden && !mine ? null : c.author,
      issueKey: c.issue ? formatIssueKey(c.issue.project.key, c.issue.number) : null,
      myVote: c.votes.some((v) => v.userId === viewerId),
      votes: totals ? c.votes.length : null,
    };
  });
  const votesUsed = retro.cards.reduce(
    (n, c) => n + (c.votes.some((v) => v.userId === viewerId) ? 1 : 0),
    0,
  );
  const participants = new Set(retro.cards.map((c) => c.authorId).filter(Boolean)).size;
  return {
    ...retro,
    columns: retro.columns as unknown as RetroColumn[],
    cards,
    votesUsed,
    participants,
  };
}

export type RetroView = NonNullable<Awaited<ReturnType<typeof getRetro>>>;

async function load(workspaceId: string, retroId: string) {
  const retro = await db.retro.findFirst({
    where: { id: retroId, workspaceId },
    select: {
      id: true,
      phase: true,
      columns: true,
      createdById: true,
      votesPerPerson: true,
      projectId: true,
      name: true,
    },
  });
  if (!retro) throw new AppError("not_found", "Retro not found");
  return { ...retro, columns: retro.columns as unknown as RetroColumn[] };
}

export async function createRetro(input: {
  workspaceId: string;
  userId: string;
  projectId: string;
  sprintId: string | null;
  name: string;
  template: RetroTemplate;
  votesPerPerson: number;
}) {
  await assertWorkspacePermission(input.workspaceId, input.userId, "issues:update");
  const project = await db.project.findFirst({
    where: { id: input.projectId, workspaceId: input.workspaceId },
    select: { id: true },
  });
  if (!project) throw new AppError("validation_failed", "Project not found");
  if (input.sprintId) {
    const sprint = await db.sprint.count({
      where: { id: input.sprintId, projectId: input.projectId },
    });
    if (!sprint) throw new AppError("validation_failed", "Sprint not found");
  }
  return db.retro.create({
    data: {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      sprintId: input.sprintId,
      name: input.name,
      votesPerPerson: input.votesPerPerson,
      columns: RETRO_TEMPLATES[input.template].columns,
      createdById: input.userId,
    },
    select: { id: true, name: true },
  });
}

export async function setRetroPhase(
  workspaceId: string,
  userId: string,
  retroId: string,
  phase: RetroPhase,
) {
  const role = await assertWorkspacePermission(workspaceId, userId, "issues:update");
  const retro = await load(workspaceId, retroId);
  // The facilitator (whoever created it) or an admin moves the retro along.
  if (retro.createdById !== userId && !can(role, "projects:update")) {
    throw new AppError("forbidden", "Only the facilitator or an admin can change the phase");
  }
  await db.$transaction(async (tx) => {
    await tx.retro.update({ where: { id: retroId }, data: { phase } });
    await publishRoomChanged(tx, workspaceId, "retro", retroId, userId);
  });
}

export async function addRetroCard(
  workspaceId: string,
  userId: string,
  retroId: string,
  columnId: string,
  body: string,
) {
  await assertWorkspacePermission(workspaceId, userId, "issues:update");
  const retro = await load(workspaceId, retroId);
  const column = retro.columns.find((c) => c.id === columnId);
  if (!column) throw new AppError("validation_failed", "Column not found");
  // Action items can be added while discussing; other cards only while brainstorming.
  const open = retro.phase === "brainstorm" || (column.actions && retro.phase === "discuss");
  if (!open) throw new AppError("conflict", "Cards can't be added in this phase");
  return db.$transaction(async (tx) => {
    const card = await tx.retroCard.create({
      data: { retroId, columnId, body, authorId: userId },
      select: { id: true },
    });
    await publishRoomChanged(tx, workspaceId, "retro", retroId, userId);
    return card;
  });
}

async function ownCard(workspaceId: string, userId: string, cardId: string) {
  await assertWorkspacePermission(workspaceId, userId, "issues:update");
  const card = await db.retroCard.findFirst({
    where: { id: cardId, retro: { workspaceId } },
    select: { id: true, authorId: true, retroId: true, retro: { select: { phase: true } } },
  });
  if (!card) throw new AppError("not_found", "Card not found");
  if (card.retro.phase === "closed") throw new AppError("conflict", "This retro is closed");
  if (card.authorId !== userId)
    throw new AppError("forbidden", "You can only change your own cards");
  return card;
}

export async function editRetroCard(
  workspaceId: string,
  userId: string,
  cardId: string,
  body: string,
) {
  const card = await ownCard(workspaceId, userId, cardId);
  await db.$transaction(async (tx) => {
    await tx.retroCard.update({ where: { id: cardId }, data: { body } });
    await publishRoomChanged(tx, workspaceId, "retro", card.retroId, userId);
  });
}

export async function deleteRetroCard(workspaceId: string, userId: string, cardId: string) {
  const card = await ownCard(workspaceId, userId, cardId);
  await db.$transaction(async (tx) => {
    await tx.retroCard.delete({ where: { id: cardId } });
    await publishRoomChanged(tx, workspaceId, "retro", card.retroId, userId);
  });
}

/** One vote per card per person, up to the retro's allowance. Voting again takes it back. */
export async function toggleRetroVote(workspaceId: string, userId: string, cardId: string) {
  await assertWorkspacePermission(workspaceId, userId, "issues:update");
  const card = await db.retroCard.findFirst({
    where: { id: cardId, retro: { workspaceId } },
    select: { retroId: true, retro: { select: { phase: true, votesPerPerson: true } } },
  });
  if (!card) throw new AppError("not_found", "Card not found");
  if (card.retro.phase !== "vote") throw new AppError("conflict", "Voting isn't open");
  return db.$transaction(async (tx) => {
    const existing = await tx.retroVote.findUnique({
      where: { cardId_userId: { cardId, userId } },
    });
    if (existing) {
      await tx.retroVote.delete({ where: { cardId_userId: { cardId, userId } } });
    } else {
      const used = await tx.retroVote.count({ where: { userId, card: { retroId: card.retroId } } });
      if (used >= card.retro.votesPerPerson) {
        throw new AppError(
          "conflict",
          `You've used all ${card.retro.votesPerPerson} votes. Take one back first.`,
        );
      }
      await tx.retroVote.create({ data: { cardId, userId } });
    }
    return { voted: !existing };
  });
}

/** Turns an action item into a task in the retro's project, assigned to nobody. */
export async function retroCardToIssue(workspaceId: string, userId: string, cardId: string) {
  await assertWorkspacePermission(workspaceId, userId, "issues:create");
  const card = await db.retroCard.findFirst({
    where: { id: cardId, retro: { workspaceId } },
    select: {
      body: true,
      columnId: true,
      issueId: true,
      retro: { select: { id: true, name: true, projectId: true, columns: true } },
    },
  });
  if (!card) throw new AppError("not_found", "Card not found");
  const column = (card.retro.columns as unknown as RetroColumn[]).find(
    (c) => c.id === card.columnId,
  );
  if (!column?.actions) throw new AppError("validation_failed", "Only action items become issues");
  if (card.issueId) throw new AppError("conflict", "This action item is already an issue");
  const firstLine = card.body.split("\n")[0]!.trim();
  const title = firstLine.length > 250 ? `${firstLine.slice(0, 247)}…` : firstLine;
  const issue = await createIssue({
    workspaceId,
    projectId: card.retro.projectId,
    userId,
    title,
    description: `${card.body}\n\n_Action item from the retro “${card.retro.name}”._`,
    type: "task",
    priority: "medium",
  });
  await db.$transaction(async (tx) => {
    await tx.retroCard.update({ where: { id: cardId }, data: { issueId: issue.id } });
    await publishRoomChanged(tx, workspaceId, "retro", card.retro.id, userId);
  });
  return issue;
}

export async function deleteRetro(workspaceId: string, userId: string, retroId: string) {
  const role = await assertWorkspacePermission(workspaceId, userId, "issues:update");
  const retro = await load(workspaceId, retroId);
  if (retro.createdById !== userId && !can(role, "projects:update")) {
    throw new AppError("forbidden", "Only the facilitator or an admin can delete a retro");
  }
  await db.retro.delete({ where: { id: retroId } });
}

/** Projects with their recent sprints, for the "New retro" dialog. */
export async function listRetroProjects(workspaceId: string) {
  return db.project.findMany({
    where: { workspaceId, archivedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      sprints: {
        where: { state: { not: "planned" } },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, name: true, state: true },
      },
    },
  });
}
