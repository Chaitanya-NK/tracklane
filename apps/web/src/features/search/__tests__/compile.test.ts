import { parseTql } from "@tracklane/core";
import { describe, expect, it } from "vitest";
import { compileTql } from "../compile";

const ctx = { workspaceId: "ws", userId: "me", now: new Date("2026-11-11T12:00:00Z") };
const compile = (input: string) => {
  const parsed = parseTql(input);
  if (!parsed.ok) throw new Error(parsed.error.message);
  const result = compileTql(parsed.query, ctx);
  if (!result.ok) throw new Error(result.message);
  return result;
};
const where = (input: string) => (compile(input).where as { AND: unknown[] }).AND[1];

describe("compileTql", () => {
  it("always scopes to the workspace", () => {
    expect(compile("").where).toEqual({ workspaceId: "ws" });
    expect((compile("type = bug").where as { AND: unknown[] }).AND[0]).toEqual({
      workspaceId: "ws",
    });
  });

  it("compiles equality, lists and negation", () => {
    expect(where("type = bug")).toEqual({ type: "bug" });
    expect(where("status != Done")).toEqual({
      NOT: { status: { name: { equals: "Done", mode: "insensitive" } } },
    });
    expect(where("priority in (high, highest)")).toEqual({
      OR: [{ priority: "high" }, { priority: "highest" }],
    });
    expect(where("project = web")).toEqual({
      project: { OR: [{ key: "WEB" }, { name: { equals: "web", mode: "insensitive" } }] },
    });
  });

  it("compiles users, functions and emptiness", () => {
    expect(where("assignee = currentUser()")).toEqual({ assigneeId: "me" });
    expect(where("assignee is empty")).toEqual({ assigneeId: null });
    expect(where("labels is not empty")).toEqual({ NOT: { labels: { none: {} } } });
    expect(where("sprint in (openSprints())")).toEqual({
      OR: [{ sprint: { state: { in: ["active", "planned"] } } }],
    });
    expect(where("parent = WEB-1")).toEqual({ parent: { number: 1, project: { key: "WEB" } } });
  });

  it("compiles ordered comparisons", () => {
    expect(where("priority >= high")).toEqual({ priority: { in: ["high", "highest"] } });
    expect(where("points > 3")).toEqual({ estimate: { gt: 3 } });
    expect(where("created >= -7d")).toEqual({
      createdAt: { gte: new Date("2026-11-04T12:00:00Z") },
    });
    expect(where("due <= 2026-11-30")).toEqual({
      dueDate: { lt: new Date("2026-12-01T00:00:00Z") },
    });
    expect(where("due = 2026-11-30")).toEqual({
      dueDate: { gte: new Date("2026-11-30T00:00:00Z"), lt: new Date("2026-12-01T00:00:00Z") },
    });
  });

  it("compiles text search and ORDER BY", () => {
    expect(where('text ~ "login"')).toEqual({
      OR: [
        { title: { contains: "login", mode: "insensitive" } },
        { description: { contains: "login", mode: "insensitive" } },
      ],
    });
    expect(compile("ORDER BY priority DESC, key").orderBy).toEqual([
      { priority: "desc" },
      { project: { key: "asc" } },
      { number: "asc" },
      { id: "asc" },
    ]);
  });

  it("returns an error for unusable values", () => {
    const parsed = parseTql("key = banana");
    expect(parsed.ok && compileTql(parsed.query, ctx)).toEqual({
      ok: false,
      message: '"banana" isn\'t an issue key like WEB-12',
    });
  });
});
