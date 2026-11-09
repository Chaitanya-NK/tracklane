import { parseTql, type TqlParseOptions } from "@tracklane/core";
import { describe, expect, it } from "vitest";
import { type CompileContext, compileTql } from "../compile";

const parseOptions: TqlParseOptions = {
  customFields: [
    { name: "Story points", type: "number" },
    { name: "Team", type: "select", options: ["Platform", "Growth"] },
    { name: "Customer facing", type: "checkbox" },
  ],
  functions: [
    { name: "isStale", kind: "condition" },
    { name: "loop", kind: "condition" },
    { name: "deep", kind: "condition" },
    { name: "frontendTeam", kind: "values", valueKind: "user" },
    { name: "nobody", kind: "values", valueKind: "user" },
  ],
};

const ctx: CompileContext = {
  workspaceId: "ws",
  userId: "me",
  now: new Date("2026-11-11T12:00:00Z"),
  parseOptions,
  customFields: new Map([
    ["story points", { type: "number", fieldIds: ["f1", "f2"], options: new Map() }],
    ["team", { type: "select", fieldIds: ["f3"], options: new Map([["growth", ["o1"]]]) }],
    ["customer facing", { type: "checkbox", fieldIds: ["f4"], options: new Map() }],
  ]),
  functions: new Map([
    [
      "isstale",
      {
        name: "isStale",
        kind: "condition",
        body: "updated < -14d AND statusCategory != done ORDER BY key",
        values: [],
      },
    ],
    ["loop", { name: "loop", kind: "condition", body: 'filter("Loopy")', values: [] }],
    ["deep", { name: "deep", kind: "condition", body: "deep()", values: [] }],
    [
      "frontendteam",
      { name: "frontendTeam", kind: "values", body: "", values: ["a@x.dev", "b@x.dev"] },
    ],
    ["nobody", { name: "nobody", kind: "values", body: "", values: [] }],
  ]),
  savedFilters: new Map([
    ["open bugs", "type = bug AND statusCategory != done"],
    ["loopy", "loop()"],
  ]),
};

const compile = (input: string) => {
  const parsed = parseTql(input, parseOptions);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return compileTql(parsed.query, ctx);
};
const where = (input: string) => {
  const result = compile(input);
  if (!result.ok) throw new Error(result.message);
  return (result.where as { AND: unknown[] }).AND[1];
};

describe("compileTql extensions", () => {
  it("compiles custom fields against every project's field id", () => {
    expect(where('"Story points" >= 3')).toEqual({
      fieldValues: { some: { fieldId: { in: ["f1", "f2"] }, numberValue: { gte: 3 } } },
    });
    expect(where("Team = Growth")).toEqual({
      fieldValues: { some: { fieldId: { in: ["f3"] }, optionIds: { hasSome: ["o1"] } } },
    });
    expect(where('"Customer facing" = false')).toEqual({
      NOT: { fieldValues: { some: { fieldId: { in: ["f4"] }, boolValue: true } } },
    });
    expect(where('"Story points" is empty')).toEqual({
      NOT: { fieldValues: { some: { fieldId: { in: ["f1", "f2"] } } } },
    });
  });

  it("expands condition functions and saved filters", () => {
    expect(where('isStale() OR filter("Open bugs")')).toEqual({
      OR: [
        {
          AND: [
            { updatedAt: { lt: new Date("2026-10-28T12:00:00Z") } },
            { NOT: { status: { category: "done" } } },
          ],
        },
        { AND: [{ type: "bug", customTypeId: null }, { NOT: { status: { category: "done" } } }] },
      ],
    });
  });

  it("expands value lists", () => {
    expect(where("assignee in frontendTeam()")).toMatchObject({
      OR: [
        { assignee: { OR: [{ email: { equals: "a@x.dev" } }, expect.anything()] } },
        expect.anything(),
      ],
    });
    expect(where("assignee in (currentUser(), frontendTeam())")).toMatchObject({
      OR: [{ assigneeId: "me" }, {}, {}],
    });
    expect(where("assignee = nobody()")).toEqual({ id: { in: [] } });
  });

  it("detects cycles and runaway nesting", () => {
    expect(compile("loop()")).toEqual({
      ok: false,
      message: expect.stringContaining("refers back to itself"),
    });
    expect(compile("deep()")).toEqual({
      ok: false,
      message: expect.stringContaining("refers back to itself"),
    });
    expect(compile('filter("Nope")')).toEqual({
      ok: false,
      message: 'No saved filter named "Nope"',
    });
  });
});
