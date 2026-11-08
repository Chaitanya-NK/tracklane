import { describe, expect, it } from "vitest";
import { can, canAssignRole, canRemoveMember, invitableRoles } from "./permissions";

describe("workspace permissions", () => {
  it("grants by role", () => {
    expect(can("owner", "workspace:delete")).toBe(true);
    expect(can("admin", "workspace:delete")).toBe(false);
    expect(can("admin", "members:invite")).toBe(true);
    expect(can("member", "members:invite")).toBe(false);
    expect(can("member", "projects:create")).toBe(true);
    expect(can("viewer", "projects:create")).toBe(false);
    expect(can("guest", "members:read")).toBe(false);
  });

  it("only owners manage the owner role", () => {
    expect(canAssignRole("owner", "member", "owner")).toBe(true);
    expect(canAssignRole("admin", "member", "owner")).toBe(false);
    expect(canAssignRole("admin", "owner", "admin")).toBe(false);
    expect(canAssignRole("owner", "owner", "admin")).toBe(true);
  });

  it("admins manage roles up to admin", () => {
    expect(canAssignRole("admin", "member", "admin")).toBe(true);
    expect(canAssignRole("admin", "viewer", "member")).toBe(true);
    expect(canAssignRole("member", "viewer", "member")).toBe(false);
  });

  it("guards removals", () => {
    expect(canRemoveMember("owner", "owner")).toBe(true);
    expect(canRemoveMember("admin", "owner")).toBe(false);
    expect(canRemoveMember("admin", "admin")).toBe(true);
    expect(canRemoveMember("member", "viewer")).toBe(false);
  });

  it("limits invitable roles", () => {
    expect(invitableRoles("owner")).toContain("owner");
    expect(invitableRoles("admin")).toEqual(["admin", "member", "viewer", "guest"]);
    expect(invitableRoles("member")).toEqual([]);
  });
});
