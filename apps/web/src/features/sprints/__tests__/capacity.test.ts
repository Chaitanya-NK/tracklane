import { describe, expect, it } from "vitest";
import { averageVelocity, planCapacity, workingDays } from "../capacity";

describe("sprint capacity", () => {
  it("counts working days", () => {
    // Mon 9 Nov → Fri 20 Nov 2026: two working weeks.
    expect(workingDays("2026-11-09", "2026-11-20")).toBe(10);
    expect(workingDays("2026-11-14", "2026-11-15")).toBe(0);
    expect(workingDays("2026-11-20", "2026-11-09")).toBe(0);
  });

  it("shares velocity and scales by days off", () => {
    const plan = planCapacity(
      [
        { userId: "a", daysOff: 0, points: null, assigned: 8 },
        { userId: "b", daysOff: 5, points: null, assigned: 12 },
        { userId: "c", daysOff: 0, points: 4, assigned: 2 },
      ],
      { velocity: 30, days: 10 },
    );
    expect(plan.rows.map((r) => r.capacity)).toEqual([10, 5, 4]);
    expect(plan.rows.map((r) => r.over)).toEqual([false, true, false]);
    expect(plan.total).toBe(19);
    expect(plan.assigned).toBe(22);
  });

  it("has no capacity without velocity or manual points", () => {
    const plan = planCapacity([{ userId: "a", daysOff: 0, points: null, assigned: 3 }], {
      velocity: null,
      days: 10,
    });
    expect(plan.total).toBeNull();
    expect(plan.rows[0]!.over).toBe(false);
  });

  it("averages recent velocity", () => {
    expect(averageVelocity([20, null, 30, 40, 100])).toBe(30);
    expect(averageVelocity([])).toBeNull();
  });
});
