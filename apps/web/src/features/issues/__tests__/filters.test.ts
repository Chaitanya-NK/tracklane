import { describe, expect, it } from "vitest";
import { parseIssueFilters, serializeIssueFilters } from "../filters";

describe("issue filters", () => {
  it("parses and drops unknown values", () => {
    expect(
      parseIssueFilters({ q: " login ", type: "bug,nope", priority: ["high"], sort: "weird" }),
    ).toEqual({
      q: "login",
      statusIds: [],
      assignee: null,
      types: ["bug"],
      priorities: ["high"],
      sort: "updated",
    });
  });

  it("round-trips through the query string", () => {
    const filters = parseIssueFilters({ status: "a,b", assignee: "me", sort: "priority" });
    const query = serializeIssueFilters(filters);
    expect(query).toBe("?status=a%2Cb&assignee=me&sort=priority");
    expect(parseIssueFilters(Object.fromEntries(new URLSearchParams(query)))).toEqual(filters);
  });
});
