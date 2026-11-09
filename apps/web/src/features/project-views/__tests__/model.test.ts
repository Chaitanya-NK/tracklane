import { describe, expect, it } from "vitest";
import { filtersToTql, groupRows, type ListRow, parseGroupBy } from "../model";

const row = (over: Partial<ListRow>): ListRow => ({
  id: Math.random().toString(36),
  key: "PAY-1",
  title: "Thing",
  type: "task",
  customType: null,
  priority: "medium",
  status: { id: "s1", name: "To Do", category: "todo" },
  assignee: null,
  labels: [],
  estimate: null,
  dueDate: null,
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
  epic: null,
  sprint: null,
  fields: {},
  ...over,
});

describe("groupRows", () => {
  it("orders status groups by workflow and sums points", () => {
    const rows = [
      row({ status: { id: "s2", name: "Done", category: "done" }, estimate: 3 }),
      row({ estimate: 2 }),
      row({ status: { id: "s2", name: "Done", category: "done" }, estimate: 5 }),
    ];
    const groups = groupRows(rows, "status", { statusOrder: ["s1", "s2"] });
    expect(groups.map((g) => [g.label, g.rows.length, g.points])).toEqual([
      ["To Do", 1, 2],
      ["Done", 2, 8],
    ]);
  });

  it("puts highest priority first and unassigned last", () => {
    const rows = [row({ priority: "low" }), row({ priority: "highest" })];
    expect(groupRows(rows, "priority", { statusOrder: [] }).map((g) => g.key)).toEqual([
      "highest",
      "low",
    ]);
    const people = [row({}), row({ assignee: { id: "u1", name: "Ana", image: null } })];
    expect(groupRows(people, "assignee", { statusOrder: [] }).map((g) => g.label)).toEqual([
      "Ana",
      "Unassigned",
    ]);
  });

  it("groups by custom field value", () => {
    const rows = [row({ fields: { f1: "Web" } }), row({})];
    expect(groupRows(rows, "field:f1", { statusOrder: [] }).map((g) => g.label)).toEqual([
      "Web",
      "No value",
    ]);
  });

  it("validates group names", () => {
    expect(parseGroupBy("epic", [])).toBe("epic");
    expect(parseGroupBy("field:x", [])).toBe("none");
    expect(parseGroupBy("field:x", [{ id: "x", name: "Team" }])).toBe("field:x");
  });
});

describe("filtersToTql", () => {
  it("turns list filters into TQL", () => {
    expect(
      filtersToTql(
        "PAY",
        {
          q: "card fail",
          statusIds: ["s1"],
          assignee: "u1",
          types: ["bug"],
          priorities: [],
          sort: "priority",
        },
        { statuses: [{ id: "s1", name: "In Progress" }], people: [{ id: "u1", email: "a@x.dev" }] },
      ),
    ).toBe(
      'project = PAY AND status IN ("In Progress") AND assignee = a@x.dev AND type IN (bug) AND text ~ "card fail" ORDER BY priority DESC',
    );
  });
});
