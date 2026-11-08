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
