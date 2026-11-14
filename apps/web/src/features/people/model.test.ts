import { describe, expect, it } from "vitest";
import { isValidTimeZone, parseProfileTab, profileSchema } from "./model";

describe("profileSchema", () => {
  it("trims and turns blanks into null", () => {
    const parsed = profileSchema.parse({
      name: "  Ana  ",
      jobTitle: " ",
      department: "Platform",
      location: "",
      timezone: "",
      bio: "Hi",
    });
    expect(parsed).toEqual({
      name: "Ana",
      jobTitle: null,
      department: "Platform",
      location: null,
      timezone: null,
      bio: "Hi",
    });
  });
  it("rejects unknown time zones and empty names", () => {
    const base = { name: "Ana", jobTitle: "", department: "", location: "", bio: "" };
    expect(profileSchema.safeParse({ ...base, timezone: "Mars/Base" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, name: " ", timezone: "" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, timezone: "Asia/Kolkata" }).success).toBe(true);
  });
});

describe("helpers", () => {
  it("validates zones and tabs", () => {
    expect(isValidTimeZone("Europe/Berlin")).toBe(true);
    expect(isValidTimeZone("Nowhere")).toBe(false);
    expect(parseProfileTab("activity")).toBe("activity");
    expect(parseProfileTab("nope")).toBe("work");
  });
});
