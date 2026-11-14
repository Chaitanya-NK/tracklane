import { describe, expect, it } from "vitest";
import { modernTimeZone, timeZoneOptions } from "./time-zones";

describe("time zones", () => {
  it("uses current names", () => {
    expect(modernTimeZone("Asia/Calcutta")).toBe("Asia/Kolkata");
    expect(modernTimeZone("Europe/Paris")).toBe("Europe/Paris");
    const ids = timeZoneOptions().map((o) => o.id);
    expect(ids).toContain("Asia/Kolkata");
    expect(ids).not.toContain("Asia/Calcutta");
  });
  it("labels offsets, half hours included", () => {
    const kolkata = timeZoneOptions(new Date("2026-01-15T00:00:00Z")).find(
      (o) => o.id === "Asia/Kolkata",
    );
    expect(kolkata?.offset).toBe("GMT+5:30");
    expect(kolkata?.keywords).toContain("Kolkata");
  });
});
