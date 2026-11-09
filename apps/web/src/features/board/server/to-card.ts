import { formatIssueKey } from "@tracklane/core";
import type { PlanningIssue } from "@/features/sprints/server";
import type { PlanningCard } from "../types";

/** Server row → client card. */
export function toPlanningCard(issue: PlanningIssue): PlanningCard {
  return {
    id: issue.id,
    key: formatIssueKey(issue.project.key, issue.number),
    title: issue.title,
    type: issue.type,
    priority: issue.priority,
    estimate: issue.estimate,
    statusId: issue.status.id,
    status: { name: issue.status.name, category: issue.status.category },
    sprintId: issue.sprintId,
    assignee: issue.assignee,
    labels: issue.labels.map((l) => l.label),
    parent: issue.parent
      ? {
          id: issue.parent.id,
          key: formatIssueKey(issue.project.key, issue.parent.number),
          title: issue.parent.title,
          type: issue.parent.type,
        }
      : null,
    dueDate: issue.dueDate ? issue.dueDate.toISOString().slice(0, 10) : null,
    customType: issue.customType,
    blockedBy: issue.linksIn.map((l) => formatIssueKey(l.source.project.key, l.source.number)),
    flagged: issue.flagged,
    updatedAt: issue.updatedAt.toISOString(),
    subtasks: issue.children.length
      ? {
          done: issue.children.filter((c) => c.status.category === "done").length,
          total: issue.children.length,
        }
      : null,
  };
}
