import { describe, expect, it } from "vitest";
import { compactNumber, initials } from "../format";
import { cn } from "../utils";

describe("format helpers", () => {
  it("builds initials", () => {
    expect(initials("Chaitanya N")).toBe("CN");
    expect(initials("dev@acmelabs.dev")).toBe("DE");
    expect(initials("ananya.rao@acme.dev")).toBe("AR");
    expect(initials("")).toBe("?");
  });

  it("formats compact numbers", () => {
    expect(compactNumber(1284, "en-US")).toBe("1.3K");
  });

  it("merges tailwind classes", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });
});

describe("date and size formatting", async () => {
  const { formatBytes, formatDate, relativeTime, toDateInputValue } = await import("../format");
  it("formats calendar dates in UTC", () => {
    expect(formatDate(new Date("2026-12-31T00:00:00Z"))).toBe("31 Dec 2026");
    expect(toDateInputValue(new Date("2026-12-31T00:00:00Z"))).toBe("2026-12-31");
    expect(toDateInputValue(null)).toBe("");
  });
  it("formats relative times", () => {
    const now = new Date("2026-11-08T12:00:00Z");
    expect(relativeTime(new Date("2026-11-08T11:57:00Z"), now)).toBe("3 minutes ago");
    expect(relativeTime(new Date("2026-11-10T12:00:00Z"), now)).toBe("in 2 days");
    expect(relativeTime(now, now)).toBe("just now");
  });
  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
