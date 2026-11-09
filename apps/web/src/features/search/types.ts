import type { IssueType, Priority, StatusCategory } from "@tracklane/core";

export interface SearchIssue {
  id: string;
  key: string;
  title: string;
  type: IssueType;
  priority: Priority;
  status: { name: string; category: StatusCategory };
  project: { key: string; name: string };
  assignee: { id: string; name: string; image: string | null } | null;
  labels: { id: string; name: string; color: string }[];
  estimate: number | null;
  dueDate: string | null;
  updatedAt: string;
  customType?: { name: string; color: string; icon: string } | null;
}

export interface FilterSummary {
  id: string;
  name: string;
  description: string;
  query: string;
  shared: boolean;
  starred: boolean;
  mine: boolean;
  ownerName: string;
}
