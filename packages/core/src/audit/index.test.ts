import { describe, expect, it } from "vitest";
import { actionsInCategory, auditActionLabel } from "./index";

describe("audit actions", () => {
  it("labels known actions and passes unknown ones through", () => {
    expect(auditActionLabel("member.role_changed")).toBe("Changed a member's role");
    expect(auditActionLabel("something.else")).toBe("something.else");
  });
  it("lists a category's actions", () => {
    expect(actionsInCategory("members")).toContain("member.invited");
    expect(actionsInCategory("security")).not.toContain("member.invited");
  });
});
