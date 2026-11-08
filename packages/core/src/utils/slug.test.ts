import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("creates url-safe slugs", () => {
    expect(slugify("Acme Labs!")).toBe("acme-labs");
    expect(slugify("  Crème brûlée  ")).toBe("creme-brulee");
    expect(slugify("a".repeat(60), 10)).toBe("aaaaaaaaaa");
  });
});
