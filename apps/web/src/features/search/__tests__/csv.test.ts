import { describe, expect, it } from "vitest";
import { csvField } from "../server/csv";

describe("csvField", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvField('Say "hi", then\nleave')).toBe('"Say ""hi"", then\nleave"');
    expect(csvField(null)).toBe("");
    expect(csvField(5)).toBe("5");
  });
  it("neutralises spreadsheet formulas", () => {
    expect(csvField("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvField("-2")).toBe("'-2");
  });
});
