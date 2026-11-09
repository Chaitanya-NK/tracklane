import { describe, expect, it } from "vitest";
import { monthGrid, monthLabel, parseMonth, shiftMonth } from "../month";

describe("calendar month", () => {
  it("parses and shifts months", () => {
    expect(parseMonth("2026-11", "2026-01-05")).toBe("2026-11");
    expect(parseMonth("2026-13", "2026-01-05")).toBe("2026-01");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
  it("builds a Monday-first 6-week grid", () => {
    const grid = monthGrid("2026-11"); // 1 Nov 2026 is a Sunday
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe("2026-10-26");
    expect(grid[6]).toBe("2026-11-01");
    expect(monthLabel("2026-11")).toBe("November 2026");
  });
});

describe("week grid", () => {
  it("starts on Monday", async () => {
    const { mondayOf, weekGrid, shiftWeek } = await import("../month");
    expect(mondayOf("2026-11-15")).toBe("2026-11-09");
    expect(weekGrid("2026-11-09").at(-1)).toBe("2026-11-15");
    expect(shiftWeek("2026-11-09", -1)).toBe("2026-11-02");
  });
});
