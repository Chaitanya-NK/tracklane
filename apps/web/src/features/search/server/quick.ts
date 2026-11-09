import "server-only";
import { formatIssueKey, parseIssueKey } from "@tracklane/core";
import { db, type Prisma } from "@tracklane/db";

export interface QuickIssue {
  id: string;
  key: string;
  title: string;
  type: string;
  status: { name: string; category: string };
}

/** Issues for the command palette: an exact key first, then title matches, most recent first. */
export async function quickSearchIssues(workspaceId: string, q: string): Promise<QuickIssue[]> {
  const text = q.trim().slice(0, 100);
  if (!text) {
    return [];
  }
  const key = parseIssueKey(text);
  const or: Prisma.IssueWhereInput[] = [{ title: { contains: text, mode: "insensitive" } }];
  if (key) or.unshift({ number: key.number, project: { key: key.projectKey } });
  if (/^\d+$/.test(text)) or.push({ number: Number(text) });
  const issues = await db.issue.findMany({
    where: { workspaceId, project: { archivedAt: null }, OR: or },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      id: true,
      number: true,
      title: true,
      type: true,
      project: { select: { key: true } },
      status: { select: { name: true, category: true } },
    },
  });
  const rows = issues.map((i) => ({
    id: i.id,
    key: formatIssueKey(i.project.key, i.number),
    title: i.title,
    type: i.type,
    status: i.status,
  }));
  // Exact key match on top.
  const exact = key ? formatIssueKey(key.projectKey, key.number) : null;
  return rows.sort((a, b) => Number(b.key === exact) - Number(a.key === exact));
}

/** What the palette needs to act on the issue being viewed. */
export async function issueContext(workspaceId: string, issueKey: string) {
  const key = parseIssueKey(issueKey);
  if (!key) return null;
  const issue = await db.issue.findFirst({
    where: { workspaceId, number: key.number, project: { key: key.projectKey } },
    select: {
      id: true,
      assigneeId: true,
      status: { select: { name: true } },
      project: {
        select: {
          statuses: { orderBy: { position: "asc" }, select: { name: true, category: true } },
        },
      },
    },
  });
  if (!issue) return null;
  return {
    id: issue.id,
    key: formatIssueKey(key.projectKey, key.number),
    assigneeId: issue.assigneeId,
    status: issue.status.name,
    statuses: issue.project.statuses,
  };
}
