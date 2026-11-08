import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, matchesFilters } from "../filters";
import type { PlanningCard } from "../types";

const card = (over: Partial<PlanningCard>): PlanningCard => ({
  id: "1",
  key: "WEB-1",
  title: "Fix login",
  type: "bug",
  priority: "high",
  estimate: null,
  statusId: "s",
  status: { name: "To Do", category: "todo" },
  sprintId: null,
  assignee: null,
  labels: [],
  parent: null,
  dueDate: null,
  ...over,
});

describe("card filters", () => {
  const me = { id: "me", name: "Me", image: null };
  it("filters by text, key and assignee", () => {
    expect(matchesFilters(card({}), { ...EMPTY_FILTERS, q: "login" }, "me")).toBe(true);
    expect(matchesFilters(card({}), { ...EMPTY_FILTERS, q: "web-1" }, "me")).toBe(true);
    expect(matchesFilters(card({}), { ...EMPTY_FILTERS, q: "signup" }, "me")).toBe(false);
    expect(matchesFilters(card({}), { ...EMPTY_FILTERS, onlyMine: true }, "me")).toBe(false);
    expect(matchesFilters(card({ assignee: me }), { ...EMPTY_FILTERS, onlyMine: true }, "me")).toBe(
      true,
    );
    expect(matchesFilters(card({}), { ...EMPTY_FILTERS, assignees: ["none"] }, "me")).toBe(true);
  });
});
