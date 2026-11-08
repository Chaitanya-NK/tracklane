import { describe, expect, it } from "vitest";
import { workspaceSlugSchema } from "./workspace";

describe("workspaceSlugSchema", () => {
  it("accepts good slugs and normalises case", () => {
    expect(workspaceSlugSchema.parse("Acme-Labs")).toBe("acme-labs");
  });
  it("rejects reserved and malformed slugs", () => {
    expect(workspaceSlugSchema.safeParse("settings").success).toBe(false);
    expect(workspaceSlugSchema.safeParse("acme--labs").success).toBe(false);
    expect(workspaceSlugSchema.safeParse("a").success).toBe(false);
  });
});
