import { describe, expect, it } from "vitest";
import { highlightTql } from "./highlight";

const kinds = (q: string) =>
  highlightTql(q)
    .filter((s) => s.kind !== "space")
    .map((s) => `${s.kind}:${s.text}`);

describe("highlightTql", () => {
  it("round-trips the input", () => {
    const q = 'project = PAY AND status IN ("To Do", Done)\n  ORDER BY priority DESC';
    expect(
      highlightTql(q)
        .map((s) => s.text)
        .join(""),
    ).toBe(q);
  });

  it("classifies fields, operators, values and keywords", () => {
    expect(kinds("project = PAY AND assignee in (currentUser())")).toEqual([
      "field:project",
      "operator:=",
      "value:PAY",
      "keyword:AND",
      "field:assignee",
      "keyword:in",
      "punctuation:(",
      "function:currentUser",
      "punctuation:())",
    ]);
  });

  it("handles NOT IN, IS EMPTY and ORDER BY", () => {
    expect(kinds("label not in (a) and due is empty order by updated desc")).toEqual([
      "field:label",
      "keyword:not",
      "keyword:in",
      "punctuation:(",
      "value:a",
      "punctuation:)",
      "keyword:and",
      "field:due",
      "keyword:is",
      "keyword:empty",
      "keyword:order",
      "keyword:by",
      "field:updated",
      "keyword:desc",
    ]);
  });

  it("never throws on broken input", () => {
    expect(kinds('summary ~ "unclosed')).toEqual([
      "field:summary",
      "operator:~",
      'string:"unclosed',
    ]);
    expect(kinds("a ? b")).toContain("error:?");
  });
});
