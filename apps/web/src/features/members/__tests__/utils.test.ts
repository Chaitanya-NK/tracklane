import { describe, expect, it } from "vitest";
import { parseEmailList } from "../utils";

describe("parseEmailList", () => {
  it("splits on commas, whitespace and semicolons and dedupes", () => {
    expect(parseEmailList("A@acme.dev, b@acme.dev\nb@acme.dev; c@acme.dev")).toEqual({
      valid: ["a@acme.dev", "b@acme.dev", "c@acme.dev"],
      invalid: [],
    });
  });

  it("reports invalid entries", () => {
    expect(parseEmailList("ok@acme.dev nope")).toEqual({
      valid: ["ok@acme.dev"],
      invalid: ["nope"],
    });
    expect(parseEmailList("   ")).toEqual({ valid: [], invalid: [] });
  });
});
