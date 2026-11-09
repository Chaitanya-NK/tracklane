import "server-only";
import {
  AppError,
  canApprove,
  formatIssueKey,
  ROLE_RANK,
  type WorkspaceRole,
} from "@tracklane/core";
import { db } from "@tracklane/db";
import { updateIssue } from "@/features/issues/server/service";
import { actorName, notify } from "@/features/notifications/server/notify";

const requestSelect = {
  id: true,
  createdAt: true,
  approverRole: true,
  note: true,
  requestedById: true,
  from: { select: { id: true, name: true, category: true } },
  to: { select: { id: true, name: true, category: true } },
  requestedBy: { select: { id: true, name: true, image: true } },
} as const;

/** Roles at or above `role`'s rank: the approver roles `role` satisfies. */
function rolesApprovableBy(role: WorkspaceRole): WorkspaceRole[] {
  if (role === "guest") return [];
  return (Object.keys(ROLE_RANK) as WorkspaceRole[]).filter(
    (r) => r !== "guest" && ROLE_RANK[r] <= ROLE_RANK[role],
  );
}

/** The open request on an issue, if any (there is at most one). */
export async function getPendingApproval(issueId: string) {
  return db.approvalRequest.findFirst({
    where: { issueId, state: "pending" },
    select: requestSelect,
  });
}

export type PendingApproval = NonNullable<Awaited<ReturnType<typeof getPendingApproval>>>;

/** Requests the user can decide on, oldest first (the home page's "Waiting for you"). */
export async function listApprovalsForUser(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
) {
  const roles = rolesApprovableBy(role);
  if (!roles.length) return [];
  const requests = await db.approvalRequest.findMany({
    where: {
      state: "pending",
      approverRole: { in: roles },
      issue: { workspaceId, project: { archivedAt: null } },
    },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: {
      ...requestSelect,
      issue: {
        select: {
          id: true,
          number: true,
          title: true,
          type: true,
          project: { select: { key: true } },
        },
      },
    },
  });
  return requests.map((r) => ({ ...r, key: formatIssueKey(r.issue.project.key, r.issue.number) }));
}

export type ApprovalListItem = Awaited<ReturnType<typeof listApprovalsForUser>>[number];

async function loadRequest(requestId: string) {
  const request = await db.approvalRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      state: true,
      approverRole: true,
      requestedById: true,
      issueId: true,
      toStatusId: true,
      to: { select: { name: true } },
      issue: { select: { workspaceId: true, number: true, project: { select: { key: true } } } },
    },
  });
  if (!request) throw new AppError("not_found", "Approval request not found");
  return request;
}

async function roleIn(workspaceId: string, userId: string) {
  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  });
  if (!membership) throw new AppError("not_found", "Approval request not found");
  return membership.role;
}

/** Claims a pending request, so two approvers clicking at once can't both decide it. */
async function claim(
  requestId: string,
  state: "approved" | "rejected" | "cancelled",
  userId: string,
  note: string,
) {
  const { count } = await db.approvalRequest.updateMany({
    where: { id: requestId, state: "pending" },
    data: { state, decidedById: userId, decidedAt: new Date(), note },
  });
  if (!count) throw new AppError("conflict", "Someone already decided this request");
}

export async function decideApproval(input: {
  requestId: string;
  userId: string;
  decision: "approve" | "reject";
  note: string;
}) {
  const request = await loadRequest(input.requestId);
  const role = await roleIn(request.issue.workspaceId, input.userId);
  if (!canApprove(role, request.approverRole)) {
    throw new AppError("forbidden", "You can't approve this move");
  }
  const key = formatIssueKey(request.issue.project.key, request.issue.number);
  await claim(
    request.id,
    input.decision === "approve" ? "approved" : "rejected",
    input.userId,
    input.note,
  );

  if (input.decision === "approve") {
    try {
      await updateIssue({
        issueId: request.issueId,
        userId: input.userId,
        patch: { statusId: request.toStatusId },
        approved: true,
      });
    } catch (error) {
      // Couldn't apply (e.g. the status was deleted): reopen the request.
      await db.approvalRequest.update({
        where: { id: request.id },
        data: { state: "pending", decidedById: null, decidedAt: null, note: "" },
      });
      throw error;
    }
  }
  if (request.requestedById) {
    const actor = await actorName(db, input.userId);
    await notify(db, {
      type: "approval_decided",
      workspaceId: request.issue.workspaceId,
      issueId: request.issueId,
      actorId: input.userId,
      recipientIds: [request.requestedById],
      title:
        input.decision === "approve"
          ? `${actor} approved moving ${key} to ${request.to.name}`
          : `${actor} rejected moving ${key} to ${request.to.name}`,
      body: input.note,
    });
  }
  await db.issueActivity.create({
    data: {
      issueId: request.issueId,
      actorId: input.userId,
      action: input.decision === "approve" ? "approval_approved" : "approval_rejected",
      field: "status",
      toValue: request.to.name,
    },
  });
  return { key, toStatus: request.to.name };
}

/** The requester (or an admin) withdraws a pending request. */
export async function cancelApproval(input: { requestId: string; userId: string }) {
  const request = await loadRequest(input.requestId);
  const role = await roleIn(request.issue.workspaceId, input.userId);
  if (request.requestedById !== input.userId && ROLE_RANK[role] < ROLE_RANK.admin) {
    throw new AppError("forbidden", "Only the person who asked (or an admin) can withdraw this");
  }
  await claim(request.id, "cancelled", input.userId, "");
  await db.issueActivity.create({
    data: {
      issueId: request.issueId,
      actorId: input.userId,
      action: "approval_cancelled",
      field: "status",
      toValue: request.to.name,
    },
  });
}

export type ApprovalTab = "waiting" | "mine" | "done";

/** The approvals page: waiting on me, requested by me, or recently decided. Newest first. */
export async function listApprovalInbox(input: {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  tab: ApprovalTab;
}) {
  const scope = { issue: { workspaceId: input.workspaceId, project: { archivedAt: null } } };
  const roles = rolesApprovableBy(input.role);
  const where =
    input.tab === "waiting"
      ? { ...scope, state: "pending" as const, approverRole: { in: roles } }
      : input.tab === "mine"
        ? { ...scope, state: "pending" as const, requestedById: input.userId }
        : {
            ...scope,
            state: { not: "pending" as const },
            OR: [{ requestedById: input.userId }, { decidedById: input.userId }],
          };
  if (input.tab === "waiting" && !roles.length) return [];
  const requests = await db.approvalRequest.findMany({
    where,
    orderBy: input.tab === "done" ? { decidedAt: "desc" } : { createdAt: "desc" },
    take: 50,
    select: {
      ...requestSelect,
      state: true,
      decidedAt: true,
      decidedBy: { select: { id: true, name: true } },
      issue: {
        select: {
          id: true,
          number: true,
          title: true,
          type: true,
          description: true,
          priority: true,
          assignee: { select: { id: true, name: true, image: true } },
          project: { select: { key: true, name: true } },
        },
      },
    },
  });
  return requests.map((r) => ({
    ...r,
    key: formatIssueKey(r.issue.project.key, r.issue.number),
    canDecide: r.state === "pending" && canApprove(input.role, r.approverRole),
    canWithdraw: r.state === "pending" && r.requestedById === input.userId,
  }));
}

export type ApprovalInboxItem = Awaited<ReturnType<typeof listApprovalInbox>>[number];

/** How many requests wait on the user (for the sidebar badge and tab count). */
export async function countApprovalsWaiting(workspaceId: string, role: WorkspaceRole) {
  const roles = rolesApprovableBy(role);
  if (!roles.length) return 0;
  return db.approvalRequest.count({
    where: {
      state: "pending",
      approverRole: { in: roles },
      issue: { workspaceId, project: { archivedAt: null } },
    },
  });
}
