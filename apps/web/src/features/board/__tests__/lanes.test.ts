import { describe, expect, it } from "vitest";
import { cellId, cellsFrom, lanePatchFor, laneProblem, lanesFor, parseCellId } from "../lanes";
import type { PlanningCard } from "../types";

const card = (id: string, patch: Partial<PlanningCard> = {}): PlanningCard => ({
  id,
  key: `WEB-${id}`,
  title: id,
  type: "task",
  priority: "medium",
  estimate: null,
  statusId: "todo",
  status: { name: "To Do", category: "todo" },
  sprintId: null,
  assignee: null,
  labels: [],
  parent: null,
  dueDate: null,
  customType: null,
  blockedBy: [],
  flagged: false,
  updatedAt: "2026-11-09T10:00:00Z",
  subtasks: null,
  ...patch,
});

const priya = { id: "u1", name: "Priya", image: null };
const epic = { id: "e1", key: "WEB-1", title: "Checkout", type: "epic" as const };
const story = { id: "s1", key: "WEB-2", title: "Story", type: "story" as const };
const columns = [
  { id: "todo", name: "To Do", category: "todo" as const },
  { id: "done", name: "Done", category: "done" as const },
];

describe("swimlanes", () => {
  it("round-trips cell ids", () => {
    expect(parseCellId(cellId("u1", "todo"))).toEqual({ laneId: "u1", statusId: "todo" });
    expect(parseCellId("todo")).toBeNull();
  });

  it("groups by assignee with Unassigned last", () => {
    const cards = [card("1", { assignee: priya }), card("2")];
    const lanes = lanesFor(cards, "assignee");
    expect(lanes.map((l) => l.title)).toEqual(["Priya", "Unassigned"]);
    const cells = cellsFrom(columns, lanes, cards, "assignee");
    expect(cells[cellId("u1", "todo")]).toEqual(["1"]);
    expect(cells[cellId("none", "todo")]).toEqual(["2"]);
    expect(cells[cellId("none", "done")]).toEqual([]);
  });

  it("shows every priority so empty ones accept drops", () => {
    expect(lanesFor([], "priority")).toHaveLength(5);
  });

  it("only moves top-level issues between epics", () => {
    const lanes = lanesFor([card("1", { parent: epic })], "epic");
    const epicLane = lanes[0]!;
    const noEpic = lanes.at(-1)!;
    expect(lanePatchFor(card("2"), epicLane, "epic")).toEqual({ parentId: "e1" });
    expect(lanePatchFor(card("1", { parent: epic }), noEpic, "epic")).toEqual({ parentId: null });
    expect(laneProblem(card("3", { type: "subtask", parent: story }), epicLane, "epic")).toContain(
      "WEB-2",
    );
    expect(laneProblem(card("2"), epicLane, "epic")).toBeNull();
  });
});
