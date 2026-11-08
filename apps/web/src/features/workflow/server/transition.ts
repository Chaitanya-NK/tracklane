import "server-only";
import { AppError, canApprove, decideTransition, type WorkspaceRole } from "@tracklane/core";
import type { Prisma } from "@tracklane/db";

type Tx = Prisma.TransactionClient;

export type StatusChange =
  /** Apply the new status now. */
  | { kind: "apply" }
  /** The move needs approval: a request was filed and the status stays as it is. */
  | { kind: "approval"; requestId: string; toStatus: string; approverRole: WorkspaceRole };

/**
 * The workflow gate for every status change (detail panel, board drag, bulk edit). Throws when
 * the project's workflow doesn't allow the move; files an approval request when the transition
 * needs one, unless the person moving the issue is an eligible approver themselves.
 */
export async function gateStatusChange(
  tx: Tx,
  input: {
    issue: { id: string; projectId: string; workspaceId: string; statusId: string };
    toStatusId: string;
    userId: string;
  },
): Promise<StatusChange> {
  if (input.toStatusId === input.issue.statusId) return { kind: "apply" };
  const [project, membership] = await Promise.all([
    tx.project.findUniqueOrThrow({
      where: { id: input.issue.projectId },
      select: {
        restrictTransitions: true,
        transitions: {
          select: {
            fromStatusId: true,
            toStatusId: true,
            requiresApproval: true,
            approverRole: true,
          },
        },
        statuses: { select: { id: true, name: true } },
      },
    }),
    tx.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: input.issue.workspaceId, userId: input.userId } },
      select: { role: true },
    }),
  ]);
  const name = (id: string) => project.statuses.find((s) => s.id === id)?.name;
  const decision = decideTransition({
    restrict: project.restrictTransitions,
    rules: project.transitions,
    fromStatusId: input.issue.statusId,
    toStatusId: input.toStatusId,
    fromName: name(input.issue.statusId),
    toName: name(input.toStatusId),
  });
  if (!decision.allowed) throw new AppError("conflict", decision.reason, { field: "statusId" });
  if (!decision.requiresApproval) return { kind: "apply" };
  if (membership && canApprove(membership.role, decision.approverRole)) return { kind: "apply" };

  const pending = await tx.approvalRequest.findFirst({
    where: { issueId: input.issue.id, state: "pending" },
    select: { to: { select: { name: true } } },
  });
  if (pending) {
    throw new AppError(
      "conflict",
      `This issue is already waiting for approval to move to ${pending.to.name}`,
      { field: "statusId" },
    );
  }
  const request = await tx.approvalRequest.create({
    data: {
      issueId: input.issue.id,
      fromStatusId: input.issue.statusId,
      toStatusId: input.toStatusId,
      approverRole: decision.approverRole,
      requestedById: input.userId,
    },
    select: { id: true },
  });
  await tx.issueActivity.create({
    data: {
      issueId: input.issue.id,
      actorId: input.userId,
      action: "approval_requested",
      field: "status",
      fromValue: name(input.issue.statusId) ?? null,
      toValue: name(input.toStatusId) ?? null,
    },
  });
  return {
    kind: "approval",
    requestId: request.id,
    toStatus: name(input.toStatusId) ?? "the new status",
    approverRole: decision.approverRole,
  };
}
