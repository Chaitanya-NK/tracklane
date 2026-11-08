import type { IssueType, Priority, StatusCategory } from "@tracklane/core";

export interface CalendarIssue {
  id: string;
  key: string;
  title: string;
  type: IssueType;
  priority: Priority;
  status: { name: string; category: StatusCategory };
  due: string | null;
}
