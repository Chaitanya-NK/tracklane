import { describe, expect, it } from "vitest";
import { allowedTargets, canApprove, decideTransition, type TransitionRule } from "./transitions";

const rules: TransitionRule[] = [
  { fromStatusId: "todo", toStatusId: "doing", requiresApproval: false, approverRole: "admin" },
  { fromStatusId: "doing", toStatusId: "done", requiresApproval: true, approverRole: "admin" },
];

describe("workflow transitions", () => {
  it("allows anything when unrestricted, but still applies approval rules", () => {
    expect(
      decideTransition({ restrict: false, rules, fromStatusId: "todo", toStatusId: "done" }),
    ).toEqual({
      allowed: true,
      requiresApproval: false,
    });
    expect(
      decideTransition({ restrict: false, rules, fromStatusId: "doing", toStatusId: "done" }),
    ).toEqual({
      allowed: true,
      requiresApproval: true,
      approverRole: "admin",
    });
  });

  it("only allows listed transitions when restricted", () => {
    expect(
      decideTransition({
        restrict: true,
        rules,
        fromStatusId: "todo",
        toStatusId: "done",
        fromName: "To Do",
        toName: "Done",
      }),
    ).toEqual({ allowed: false, reason: "The workflow doesn't allow moving from To Do to Done" });
    expect(
      allowedTargets({
        restrict: true,
        rules,
        fromStatusId: "todo",
        statusIds: ["todo", "doing", "done"],
      }),
    ).toEqual(["todo", "doing"]);
  });

  it("treats approver roles as minimums", () => {
    expect(canApprove("owner", "admin")).toBe(true);
    expect(canApprove("member", "admin")).toBe(false);
    expect(canApprove("guest", "guest")).toBe(false);
  });
});
