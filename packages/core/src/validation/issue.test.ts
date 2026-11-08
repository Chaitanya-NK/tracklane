import { describe, expect, it } from "vitest";
import { dueDateSchema, issueTitleSchema, projectKeySchema } from "./issue";

describe("issue validation", () => {
  it("uppercases and validates project keys", () => {
    expect(projectKeySchema.parse(" pay ")).toBe("PAY");
    expect(projectKeySchema.safeParse("1AB").success).toBe(false);
    expect(projectKeySchema.safeParse("A").success).toBe(false);
  });

  it("validates titles and due dates", () => {
    expect(issueTitleSchema.safeParse("   ").success).toBe(false);
    expect(dueDateSchema.parse("2026-12-31")).toBe("2026-12-31");
    expect(dueDateSchema.parse(null)).toBeNull();
    expect(dueDateSchema.safeParse("2026-13-45").success).toBe(false);
  });
});
