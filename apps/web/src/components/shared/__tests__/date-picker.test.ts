import { describe, expect, it } from "vitest";
import { parseDateValue, toDateValue } from "../date-picker";

describe("date picker values", () => {
  it("round-trips calendar dates without timezone shifts", () => {
    const date = parseDateValue("2026-12-31")!;
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 11, 31]);
    expect(toDateValue(date)).toBe("2026-12-31");
  });
  it("treats empty values as no date", () => {
    expect(parseDateValue(null)).toBeUndefined();
    expect(parseDateValue("")).toBeUndefined();
  });
});
