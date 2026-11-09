import { describe, expect, it } from "vitest";
import { diffIssue, type IssueSnapshot } from "../activity";

const base: IssueSnapshot = {
  title: "Login fails",
  description: "Steps…",
  type: "Bug",
  priority: "High",
  status: "To Do",
  assignee: null,
  startDate: null,
  dueDate: null,
  estimate: null,
  parent: null,
  labels: ["auth", "web"],
  sprint: null,
  resolution: null,
  timeEstimate: null,
};

describe("diffIssue", () => {
  it("returns nothing when nothing changed (label order ignored)", () => {
    expect(diffIssue(base, { ...base, labels: ["web", "auth"] })).toEqual([]);
  });

  it("records display values for each changed field", () => {
    expect(
      diffIssue(base, {
        ...base,
        status: "In Progress",
        assignee: "Priya",
        estimate: 3,
        labels: [],
      }),
    ).toEqual([
      { field: "status", fromValue: "To Do", toValue: "In Progress" },
      { field: "assignee", fromValue: null, toValue: "Priya" },
      { field: "estimate", fromValue: null, toValue: "3" },
      { field: "labels", fromValue: "auth, web", toValue: null },
    ]);
  });

  it("doesn't copy description text into history", () => {
    expect(diffIssue(base, { ...base, description: "New text" })).toEqual([
      { field: "description", fromValue: null, toValue: null },
    ]);
  });
});
