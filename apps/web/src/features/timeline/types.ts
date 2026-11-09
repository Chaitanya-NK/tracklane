import type { IssueType, StatusCategory } from "@tracklane/core";

export interface TimelineItem {
  id: string;
  key: string;
  title: string;
  type: IssueType;
  status: { name: string; category: StatusCategory };
  assignee: { name: string; image: string | null } | null;
  start: string | null;
  due: string | null;
}

export interface TimelineEpic extends TimelineItem {
  children: TimelineItem[];
}

export interface TimelineSprint {
  name: string;
  state: "planned" | "active" | "completed";
  start: string;
  end: string;
}

export interface TimelineRelease {
  name: string;
  date: string;
  released: boolean;
}

/** "from blocks to" between two issues on the timeline. */
export interface TimelineLink {
  from: string;
  to: string;
}
