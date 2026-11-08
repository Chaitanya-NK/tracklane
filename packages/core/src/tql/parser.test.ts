import { describe, expect, it } from "vitest";
import { resolveDateFunction, resolveDateLiteral } from "./dates";
import { parseTql } from "./parser";

const ok = (input: string) => {
  const result = parseTql(input);
  if (!result.ok) throw new Error(`${result.error.message} @${result.error.position}`);
  return result.query;
};
const fail = (input: string) => {
  const result = parseTql(input);
  if (result.ok) throw new Error(`expected an error for: ${input}`);
  return result.error;
};

describe("parseTql", () => {
  it("accepts an empty query", () => {
    expect(ok("")).toEqual({ where: null, orderBy: [] });
    expect(ok("   ")).toEqual({ where: null, orderBy: [] });
  });

  it("parses a clause with canonical field names and aliases", () => {
    expect(ok("label = frontend").where).toEqual({
      type: "clause",
      field: "labels",
      op: "=",
      value: { kind: "literal", value: "frontend", quoted: false },
    });
    expect(ok("issuetype = Bug").where).toMatchObject({ field: "type", value: { value: "bug" } });
  });

  it("gives AND higher precedence than OR, and honours parentheses and NOT", () => {
    expect(ok("type = bug OR type = task AND priority = high").where).toMatchObject({
      type: "or",
      right: { type: "and" },
    });
    expect(ok("(type = bug OR type = task) AND priority = high").where).toMatchObject({
      type: "and",
      left: { type: "or" },
    });
    expect(ok("NOT status = Done").where).toMatchObject({ type: "not", expr: { field: "status" } });
  });

  it("parses lists, quoted strings, functions and emptiness", () => {
    expect(ok('status in ("To Do", "In Progress")').where).toMatchObject({
      op: "in",
      value: { kind: "list", items: [{ value: "To Do" }, { value: "In Progress" }] },
    });
    expect(ok("assignee = currentUser()").where).toMatchObject({
      value: { kind: "function", name: "currentUser" },
    });
    expect(ok("assignee is empty").where).toMatchObject({ op: "is empty" });
    expect(ok("due IS NOT NULL").where).toMatchObject({ op: "is not empty" });
    expect(ok("sprint not in (openSprints())").where).toMatchObject({ op: "not in" });
    expect(ok("statusCategory = 'in progress'").where).toMatchObject({
      value: { value: "in_progress" },
    });
  });

  it("parses dates, numbers and ORDER BY", () => {
    expect(ok("created >= -7d AND due < 2026-12-31 ORDER BY priority DESC, updated")).toMatchObject(
      {
        orderBy: [
          { field: "priority", direction: "desc" },
          { field: "updated", direction: "asc" },
        ],
      },
    );
    expect(ok("ORDER BY key").where).toBeNull();
    expect(ok("points >= 5").where).toMatchObject({ field: "points", op: ">=" });
  });

  it("reports helpful errors with positions", () => {
    expect(fail("colour = red")).toMatchObject({
      position: 0,
      message: expect.stringContaining('Unknown field "colour"'),
    });
    expect(fail("summary = login").message).toContain("doesn't support");
    expect(fail("type = story AND").message).toContain("Expected a condition");
    expect(fail("priority = urgent").message).toContain("isn't a priority");
    expect(fail("due < tomorrow").message).toContain("isn't a date");
    expect(fail("assignee = me()").message).toContain("isn't valid for assignee");
    expect(fail('summary ~ "login').message).toBe("Unclosed quote");
    expect(fail("status in (Done").message).toContain("closing parenthesis");
    expect(fail("type = bug type = task").message).toContain("Expected AND, OR or ORDER BY");
    expect(fail("ORDER BY labels").message).toContain("Can't sort by labels");
    expect(fail("points = lots").message).toContain("whole number");
  });
});

describe("TQL dates", () => {
  const now = new Date("2026-11-11T15:30:00Z"); // a Wednesday
  it("resolves relative and ISO values", () => {
    expect(resolveDateLiteral("-7d", now)?.toISOString()).toBe("2026-11-04T15:30:00.000Z");
    expect(resolveDateLiteral("2w", now)?.toISOString()).toBe("2026-11-25T15:30:00.000Z");
    expect(resolveDateLiteral("2026-12-31", now)?.toISOString()).toBe("2026-12-31T00:00:00.000Z");
    expect(resolveDateLiteral("soon", now)).toBeNull();
  });
  it("resolves functions (weeks start on Monday)", () => {
    expect(resolveDateFunction("startOfWeek", now).toISOString()).toBe("2026-11-09T00:00:00.000Z");
    expect(resolveDateFunction("endOfWeek", now).toISOString()).toBe("2026-11-15T23:59:59.999Z");
    expect(resolveDateFunction("startOfMonth", now).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(resolveDateFunction("endOfMonth", now).toISOString()).toBe("2026-11-30T23:59:59.999Z");
  });
});
