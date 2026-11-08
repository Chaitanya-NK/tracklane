import { ROLE_RANK } from "../auth/permissions";
import type { WorkspaceRole } from "../constants";

export interface TransitionRule {
  fromStatusId: string;
  toStatusId: string;
  requiresApproval: boolean;
  approverRole: WorkspaceRole;
}

export type TransitionDecision =
  | { allowed: false; reason: string }
  | { allowed: true; requiresApproval: false }
  | { allowed: true; requiresApproval: true; approverRole: WorkspaceRole };

/**
 * Whether an issue may move from one status to another. With `restrict` off any move is
 * allowed; with it on, only listed transitions are. A listed transition may need approval.
 */
export function decideTransition(input: {
  restrict: boolean;
  rules: TransitionRule[];
  fromStatusId: string;
  toStatusId: string;
  fromName?: string;
  toName?: string;
}): TransitionDecision {
  if (input.fromStatusId === input.toStatusId) return { allowed: true, requiresApproval: false };
  const rule = input.rules.find(
    (r) => r.fromStatusId === input.fromStatusId && r.toStatusId === input.toStatusId,
  );
  if (input.restrict && !rule) {
    return {
      allowed: false,
      reason: `The workflow doesn't allow moving from ${input.fromName ?? "this status"} to ${input.toName ?? "that status"}`,
    };
  }
  if (rule?.requiresApproval)
    return { allowed: true, requiresApproval: true, approverRole: rule.approverRole };
  return { allowed: true, requiresApproval: false };
}

/** Statuses an issue can move to from `fromStatusId` (for pickers and board drop targets). */
export function allowedTargets(input: {
  restrict: boolean;
  rules: TransitionRule[];
  fromStatusId: string;
  statusIds: string[];
}) {
  if (!input.restrict) return input.statusIds;
  const listed = new Set(
    input.rules.filter((r) => r.fromStatusId === input.fromStatusId).map((r) => r.toStatusId),
  );
  return input.statusIds.filter((id) => id === input.fromStatusId || listed.has(id));
}

/** Approver roles are minimums: an owner can approve what an admin can. Guests never approve. */
export function canApprove(role: WorkspaceRole, approverRole: WorkspaceRole): boolean {
  return role !== "guest" && ROLE_RANK[role] >= ROLE_RANK[approverRole];
}
