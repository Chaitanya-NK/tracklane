import "server-only";
import {
  AppError,
  formatIssueKey,
  LINK_CHOICES,
  LINK_PHRASES,
  type LinkChoice,
  parseIssueKey,
} from "@tracklane/core";
import { db, Prisma } from "@tracklane/db";
import { publishIssueChanged } from "@/features/notifications/server/issue-events";
import { assertWorkspacePermission } from "@/server/authz";

const otherSelect = {
  id: true,
  number: true,
  title: true,
  type: true,
  project: { select: { key: true } },
  status: { select: { name: true, category: true } },
  customType: { select: { name: true, color: true, icon: true } },
} satisfies Prisma.IssueSelect;

/** Both directions, phrased from this issue's side ("blocks", "is blocked by"…). */
export async function listLinks(issueId: string) {
  const [out, inc] = await Promise.all([
    db.issueLink.findMany({
      where: { sourceId: issueId },
      orderBy: { createdAt: "asc" },
      select: { id: true, type: true, target: { select: otherSelect } },
    }),
    db.issueLink.findMany({
      where: { targetId: issueId },
      orderBy: { createdAt: "asc" },
      select: { id: true, type: true, source: { select: otherSelect } },
    }),
  ]);
  const row = (
    id: string,
    phrase: string,
    other: Prisma.IssueGetPayload<{ select: typeof otherSelect }>,
  ) => ({
    id,
    phrase,
    issue: {
      id: other.id,
      key: formatIssueKey(other.project.key, other.number),
      title: other.title,
      type: other.type,
      customType: other.customType,
      status: other.status,
    },
  });
  return [
    ...out.map((l) => row(l.id, LINK_PHRASES[l.type][0], l.target)),
    ...inc.map((l) => row(l.id, LINK_PHRASES[l.type][1], l.source)),
  ];
}

export type IssueLinkRow = Awaited<ReturnType<typeof listLinks>>[number];

async function issueIn(issueId: string) {
  const issue = await db.issue.findUnique({
    where: { id: issueId },
    select: { id: true, workspaceId: true, projectId: true },
  });
  if (!issue) throw new AppError("not_found", "Issue not found");
  return issue;
}

export async function addLink(input: {
  issueId: string;
  userId: string;
  choice: LinkChoice;
  otherKey: string;
}) {
  const issue = await issueIn(input.issueId);
  await assertWorkspacePermission(issue.workspaceId, input.userId, "issues:update");
  const key = parseIssueKey(input.otherKey.trim());
  if (!key)
    throw new AppError("validation_failed", "Use an issue key like WEB-12", { field: "otherKey" });
  const other = await db.issue.findFirst({
    where: { workspaceId: issue.workspaceId, number: key.number, project: { key: key.projectKey } },
    select: { id: true, projectId: true },
  });
  if (!other)
    throw new AppError("validation_failed", `There's no ${input.otherKey.toUpperCase()}`, {
      field: "otherKey",
    });
  if (other.id === issue.id)
    throw new AppError("validation_failed", "An issue can't link to itself", { field: "otherKey" });
  const choice = LINK_CHOICES.find((c) => c.value === input.choice)!;
  const [sourceId, targetId] = choice.outward ? [issue.id, other.id] : [other.id, issue.id];
  // "relates" is symmetric: one link either way.
  if (choice.type === "relates") {
    const existing = await db.issueLink.count({
      where: {
        type: "relates",
        OR: [
          { sourceId, targetId },
          { sourceId: targetId, targetId: sourceId },
        ],
      },
    });
    if (existing) throw new AppError("conflict", "Those issues are already linked");
  }
  try {
    await db.$transaction(async (tx) => {
      await tx.issueLink.create({
        data: { sourceId, targetId, type: choice.type, createdById: input.userId },
      });
      await publishIssueChanged(tx, issue, input.userId);
      await publishIssueChanged(tx, { ...other, workspaceId: issue.workspaceId }, input.userId);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("conflict", "Those issues are already linked that way");
    }
    throw error;
  }
}

export async function removeLink(input: { linkId: string; userId: string }) {
  const link = await db.issueLink.findUnique({
    where: { id: input.linkId },
    select: {
      id: true,
      source: { select: { id: true, workspaceId: true, projectId: true } },
      target: { select: { id: true, workspaceId: true, projectId: true } },
    },
  });
  if (!link) throw new AppError("not_found", "Link not found");
  await assertWorkspacePermission(link.source.workspaceId, input.userId, "issues:update");
  await db.$transaction(async (tx) => {
    await tx.issueLink.delete({ where: { id: link.id } });
    await publishIssueChanged(tx, link.source, input.userId);
    await publishIssueChanged(tx, link.target, input.userId);
  });
}

/**
 * Issues in a project joined by "blocks" links (plus the other ends, which may live in other
 * projects), for the dependency graph.
 */
export async function getDependencyGraph(projectId: string, includeDone: boolean) {
  const links = await db.issueLink.findMany({
    where: {
      type: "blocks",
      OR: [{ source: { projectId } }, { target: { projectId } }],
      ...(includeDone
        ? {}
        : {
            source: { status: { category: { not: "done" } } },
            target: { status: { category: { not: "done" } } },
          }),
    },
    take: 500,
    select: { source: { select: otherSelect }, target: { select: otherSelect } },
  });
  const nodes = new Map<string, IssueLinkRow["issue"]>();
  const toNode = (i: Prisma.IssueGetPayload<{ select: typeof otherSelect }>) => ({
    id: i.id,
    key: formatIssueKey(i.project.key, i.number),
    title: i.title,
    type: i.type,
    customType: i.customType,
    status: i.status,
  });
  for (const l of links) {
    nodes.set(l.source.id, toNode(l.source));
    nodes.set(l.target.id, toNode(l.target));
  }
  return {
    nodes: [...nodes.values()].sort((a, b) =>
      a.key.localeCompare(b.key, undefined, { numeric: true }),
    ),
    edges: links.map((l) => ({ from: l.source.id, to: l.target.id })),
  };
}
