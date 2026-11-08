import { describe, expect, it } from "vitest";
import { findNavItem, workspacePath } from "../navigation";

describe("navigation", () => {
  it("builds workspace paths", () => {
    expect(workspacePath("acme")).toBe("/acme");
    expect(workspacePath("acme", "projects")).toBe("/acme/projects");
  });

  it("finds the active item from a pathname", () => {
    expect(findNavItem("/acme")?.title).toBe("For you");
    expect(findNavItem("/acme/projects/web")?.title).toBe("Projects");
    expect(findNavItem("/acme/settings/members")?.title).toBe("Settings");
    expect(findNavItem("/acme/nope")).toBeUndefined();
  });
});
