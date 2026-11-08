import { describe, expect, it } from "vitest";
import { addDays, applyDrag, barSpan, daysBetween, timelineRange, timelineScale } from "../math";

describe("timeline math", () => {
  it("adds and diffs calendar days across months", () => {
    expect(addDays("2026-11-28", 5)).toBe("2026-12-03");
    expect(daysBetween("2026-11-01", "2026-12-01")).toBe(30);
  });

  it("pads the range to whole months around the data and today", () => {
    expect(timelineRange(["2026-11-20", "2027-01-10"], "2026-11-08")).toEqual({
      start: "2026-10-01",
      end: "2027-03-31",
    });
  });

  it("builds month and week segments", () => {
    const scale = timelineScale({ start: "2026-11-01", end: "2026-12-31" }, "weeks");
    expect(scale.totalDays).toBe(61);
    expect(scale.months.map((m) => [m.label, m.offset, m.days])).toEqual([
      ["Nov 2026", 0, 30],
      ["Dec 2026", 30, 31],
    ]);
    expect(scale.weeks[0]).toEqual({ label: "2", offset: 1, days: 7 }); // Mon 2 Nov
  });

  it("places bars, falling back when one end is missing", () => {
    expect(barSpan("2026-11-01", "2026-11-03", "2026-11-05")).toEqual({ offset: 2, days: 3 });
    expect(barSpan("2026-11-01", null, "2026-11-05")).toEqual({ offset: 4, days: 1 });
    expect(barSpan("2026-11-01", null, null)).toBeNull();
  });

  it("moves and resizes without inverting dates", () => {
    const dates = { start: "2026-11-10", due: "2026-11-14" };
    expect(applyDrag(dates, "move", 3)).toEqual({ start: "2026-11-13", due: "2026-11-17" });
    expect(applyDrag(dates, "end", -10)).toEqual({ start: "2026-11-10", due: "2026-11-10" });
    expect(applyDrag(dates, "start", 2)).toEqual({ start: "2026-11-12", due: "2026-11-14" });
  });
});
