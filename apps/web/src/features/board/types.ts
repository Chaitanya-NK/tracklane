import type { IssueType, Priority, StatusCategory } from "@tracklane/core";

/** A card on the board or a row in the backlog (plain data, safe to pass to the client). */
export interface PlanningCard {
  id: string;
  key: string;
  title: string;
  type: IssueType;
  priority: Priority;
  estimate: number | null;
  statusId: string;
  status: { name: string; category: StatusCategory };
  sprintId: string | null;
  assignee: { id: string; name: string; image: string | null } | null;
  labels: { id: string; name: string; color: string }[];
  parent: { id: string; key: string; title: string; type: IssueType } | null;
  dueDate: string | null;
}

export interface BoardColumn {
  id: string;
  name: string;
  category: StatusCategory;
}
