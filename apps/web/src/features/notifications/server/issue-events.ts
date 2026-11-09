import "server-only";
import { extractMentions } from "@tracklane/core";
import type { Prisma } from "@tracklane/db";
import { publish, rooms } from "@/server/realtime/publish";
import { actorName, issueLabel, notify, watch, watcherIds } from "./notify";

type Tx = Prisma.TransactionClient;

interface IssueState {
  id: string;
  workspaceId: string;
  projectId: string;
  assigneeId: string | null;
  statusId: string;
  status: { name: string };
  resolution?: { name: string } | null;
}

/** Tells open pages (issue, board, lists) that an issue changed. */
export async function publishIssueChanged(
  tx: Tx,
  issue: { id: string; workspaceId: string; projectId: string },
  actorId: string | null,
) {
  await publish(tx, {
    rooms: [
      rooms.issue(issue.workspaceId, issue.id),
      rooms.project(issue.workspaceId, issue.projectId),
    ],
    event: "issue:changed",
    data: { issueId: issue.id, actorId },
  });
}

/** After an issue changed: watchers, assignment and status notifications, live refresh. */
export async function onIssueUpdated(
  tx: Tx,
  before: IssueState,
  after: IssueState,
  actorId: string,
) {
  const assigned = after.assigneeId && after.assigneeId !== before.assigneeId;
  const moved = after.statusId !== before.statusId;
  if (assigned || moved) {
    const [label, actor] = await Promise.all([issueLabel(tx, after.id), actorName(tx, actorId)]);
    if (assigned) {
      await watch(tx, after.id, [after.assigneeId]);
      await notify(tx, {
        type: "assigned",
        workspaceId: after.workspaceId,
        issueId: after.id,
        actorId,
        recipientIds: [after.assigneeId!],
        title: `${actor} assigned ${label.key} to you`,
        body: label.title,
      });
    }
    if (moved) {
      const resolution = after.resolution?.name ? ` (${after.resolution.name})` : "";
      await notify(tx, {
        type: "status_changed",
        workspaceId: after.workspaceId,
        issueId: after.id,
        actorId,
        // The new assignee already heard about it.
        recipientIds: (await watcherIds(tx, after.id)).filter(
          (id) => !assigned || id !== after.assigneeId,
        ),
        title: `${actor} moved ${label.key} to ${after.status.name}${resolution}`,
        body: label.title,
      });
    }
  }
  await publishIssueChanged(tx, after, actorId);
}

export async function onIssueCreated(
  tx: Tx,
  issue: { id: string; workspaceId: string; projectId: string; assigneeId: string | null },
  actorId: string,
) {
  await watch(tx, issue.id, [actorId, issue.assigneeId]);
  if (issue.assigneeId) {
    const [label, actor] = await Promise.all([issueLabel(tx, issue.id), actorName(tx, actorId)]);
    await notify(tx, {
      type: "assigned",
      workspaceId: issue.workspaceId,
      issueId: issue.id,
      actorId,
      recipientIds: [issue.assigneeId],
      title: `${actor} assigned ${label.key} to you`,
      body: label.title,
    });
  }
  await publishIssueChanged(tx, issue, actorId);
}

/** Plain-text excerpt of a comment: mentions become names, Markdown noise is dropped. */
export function commentExcerpt(markdown: string) {
  return markdown
    .replace(/@\[([^\]]+)\]\(user:[^)]+\)/g, "@$1")
    .replace(/[`*_>#~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
}

export async function onCommentAdded(
  tx: Tx,
  issue: { id: string; workspaceId: string; projectId: string },
  authorId: string,
  body: string,
) {
  const mentioned = extractMentions(body);
  const watchers = await watcherIds(tx, issue.id);
  await watch(tx, issue.id, [authorId, ...mentioned]);
  const [label, actor] = await Promise.all([issueLabel(tx, issue.id), actorName(tx, authorId)]);
  const excerpt = commentExcerpt(body);
  await notify(tx, {
    type: "mentioned",
    workspaceId: issue.workspaceId,
    issueId: issue.id,
    actorId: authorId,
    recipientIds: mentioned,
    title: `${actor} mentioned you on ${label.key}`,
    body: excerpt,
  });
  await notify(tx, {
    type: "commented",
    workspaceId: issue.workspaceId,
    issueId: issue.id,
    actorId: authorId,
    recipientIds: watchers.filter((id) => !mentioned.includes(id)),
    title: `${actor} commented on ${label.key}`,
    body: excerpt,
  });
  await publishIssueChanged(tx, issue, authorId);
}
