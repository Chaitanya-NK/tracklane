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
  customType: null,
  blockedBy: [],
  flagged: false,
  updatedAt: "2026-11-09T10:00:00Z",
  subtasks: null,
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

  it("filters by type, epic and recent updates", () => {
    const now = new Date("2026-11-09T12:00:00Z").getTime();
    const epic = { id: "e1", key: "WEB-9", title: "Checkout", type: "epic" as const };
    expect(matchesFilters(card({}), { ...EMPTY_FILTERS, types: ["bug"] }, "me", now)).toBe(true);
    expect(matchesFilters(card({}), { ...EMPTY_FILTERS, types: ["story"] }, "me", now)).toBe(false);
    expect(
      matchesFilters(card({ parent: epic }), { ...EMPTY_FILTERS, epics: ["e1"] }, "me", now),
    ).toBe(true);
    expect(matchesFilters(card({}), { ...EMPTY_FILTERS, epics: ["none"] }, "me", now)).toBe(true);
    expect(matchesFilters(card({}), { ...EMPTY_FILTERS, recent: true }, "me", now)).toBe(true);
    expect(
      matchesFilters(
        card({ updatedAt: "2026-11-01T00:00:00Z" }),
        { ...EMPTY_FILTERS, recent: true },
        "me",
        now,
      ),
    ).toBe(false);
  });
});
