import { describe, expect, it } from "vitest";
import { cycleStats, forecastFinish } from "../cycle";

describe("cycle time", () => {
  it("summarises durations", () => {
    const stats = cycleStats([0.5, 1.5, 3, 3, 5, 10, 20]);
    expect(stats.median).toBe(3);
    expect(stats.p85).toBe(10);
    expect(stats.average).toBe(6.1);
    expect(stats.buckets.map((b) => b.count)).toEqual([1, 1, 2, 1, 1, 1]);
  });

  it("is empty without data", () => {
    expect(cycleStats([]).median).toBeNull();
  });

  it("forecasts the finish from the burn rate", () => {
    expect(
      forecastFinish({ start: "2026-11-02", today: "2026-11-07", initialScope: 30, remaining: 20 }),
    ).toBe("2026-11-17");
    expect(
      forecastFinish({ start: "2026-11-02", today: "2026-11-07", initialScope: 30, remaining: 30 }),
    ).toBeNull();
  });
});
