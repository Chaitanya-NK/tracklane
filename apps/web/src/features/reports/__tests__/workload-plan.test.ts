import { describe, expect, it } from "vitest";
import { planWorkload, workingDaysFrom } from "../workload-plan";

describe("workload plan", () => {
  // Mon 9 Nov 2026.
  const days = workingDaysFrom("2026-11-09", 5);

  it("lists working days", () => {
    expect(workingDaysFrom("2026-11-13", 3)).toEqual(["2026-11-13", "2026-11-16", "2026-11-17"]);
  });

  it("spreads hours evenly and flags overload", () => {
    const [row] = planWorkload({
      days,
      today: "2026-11-09",
      people: ["a"],
      metric: "hours",
      timeOff: [],
      issues: [
        {
          assigneeId: "a",
          startDate: null,
          dueDate: "2026-11-10",
          points: null,
          timeEstimate: 16 * 60,
        },
        {
          assigneeId: "a",
          startDate: "2026-11-11",
          dueDate: "2026-11-13",
          points: null,
          timeEstimate: 6 * 60,
        },
        { assigneeId: "a", startDate: null, dueDate: null, points: null, timeEstimate: 120 },
      ],
    });
    expect(row!.cells.map((c) => c.value)).toEqual([8, 8, 2, 2, 2]);
    expect(row!.cells.some((c) => c.over)).toBe(false);
    expect(row!.unscheduled).toBe(2);
  });

  it("skips days off and piles overdue work on day one", () => {
    const [row] = planWorkload({
      days,
      today: "2026-11-09",
      people: ["a"],
      metric: "issues",
      timeOff: [{ userId: "a", start: "2026-11-10", end: "2026-11-10" }],
      issues: [
        { assigneeId: "a", startDate: null, dueDate: "2026-11-11", points: 3, timeEstimate: null },
        { assigneeId: "a", startDate: null, dueDate: "2026-11-01", points: 1, timeEstimate: null },
      ],
    });
    expect(row!.cells[1]!.off).toBe(true);
    expect(row!.cells.map((c) => c.value)).toEqual([1.5, 0, 0.5, 0, 0]);
  });
});
