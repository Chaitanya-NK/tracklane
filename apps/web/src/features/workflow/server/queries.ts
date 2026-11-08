import "server-only";
import type { TransitionRule } from "@tracklane/core";
import { db } from "@tracklane/db";

/** Everything the workflow editor shows for a project. */
export async function getWorkflow(projectId: string) {
  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      type: true,
      restrictTransitions: true,
      backlogStatusId: true,
      statuses: {
        orderBy: { position: "asc" },
        select: { id: true, name: true, category: true, _count: { select: { issues: true } } },
      },
      transitions: {
        select: {
          fromStatusId: true,
          toStatusId: true,
          requiresApproval: true,
          approverRole: true,
        },
      },
    },
  });
  return {
    type: project.type,
    restrict: project.restrictTransitions,
    backlogStatusId: project.backlogStatusId,
    statuses: project.statuses.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      issueCount: s._count.issues,
    })),
    transitions: project.transitions,
  };
}

export type Workflow = Awaited<ReturnType<typeof getWorkflow>>;

/** What clients need to grey out moves the workflow won't allow. */
export interface TransitionRules {
  restrict: boolean;
  rules: TransitionRule[];
}

export async function getTransitionRules(projectId: string): Promise<TransitionRules> {
  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
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
    },
  });
  return { restrict: project.restrictTransitions, rules: project.transitions };
}
