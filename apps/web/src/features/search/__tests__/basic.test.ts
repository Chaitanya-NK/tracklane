import { describe, expect, it } from "vitest";
import { basicToTql, CURRENT_USER, EMPTY, emptyBasic, tqlToBasic } from "../basic";

describe("basic builder", () => {
  it("builds TQL from choices", () => {
    const basic = emptyBasic();
    basic.values.project = ["PAY"];
    basic.values.status = ["To Do", "In Progress"];
    basic.values.assignee = [CURRENT_USER, EMPTY];
    basic.text = "refund";
    basic.orderBy = "priority DESC";
    expect(basicToTql(basic)).toBe(
      'project = PAY AND status IN ("To Do", "In Progress") AND ' +
        "(assignee = currentUser() OR assignee IS EMPTY) AND text ~ refund ORDER BY priority DESC",
    );
  });

  it("round-trips through TQL", () => {
    const q =
      'project IN (PAY, WEB) AND type = bug AND (assignee = currentUser() OR assignee IS EMPTY) AND text ~ "card fail" ORDER BY updated DESC';
    const basic = tqlToBasic(q);
    expect(basic?.values.project).toEqual(["PAY", "WEB"]);
    expect(basic?.values.assignee).toEqual([CURRENT_USER, EMPTY]);
    expect(basic?.text).toBe("card fail");
    expect(basicToTql(basic!)).toBe(
      "project IN (PAY, WEB) AND type = bug AND (assignee = currentUser() OR assignee IS EMPTY) " +
        'AND text ~ "card fail" ORDER BY updated DESC',
    );
  });

  it("refuses queries it can't show", () => {
    expect(tqlToBasic("project = PAY OR type = bug")).toBeNull();
    expect(tqlToBasic("NOT project = PAY")).toBeNull();
    expect(tqlToBasic("due < now()")).toBeNull();
    expect(tqlToBasic("project = PAY AND project = WEB")).toBeNull();
    expect(tqlToBasic("project = ")).toBeNull();
    expect(tqlToBasic("")).toEqual(emptyBasic());
  });
});
