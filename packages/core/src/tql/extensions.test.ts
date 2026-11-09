import { describe, expect, it } from "vitest";

import { parseTql } from "./parser";
import { suggestTql, type TqlCatalog } from "./suggest";

const options = {
  customFields: [
    { name: "Story points", type: "number" as const },
    { name: "Team", type: "select" as const, options: ["Platform", "Growth"] },
    { name: "Customer facing", type: "checkbox" as const },
    { name: "Reviewer", type: "user" as const },
  ],
  functions: [
    { name: "isStale", kind: "condition" as const, description: "Not updated in 30 days" },
    { name: "frontendTeam", kind: "values" as const, valueKind: "user" },
  ],
};

describe("TQL extensions", () => {
  it("parses custom fields by quoted name", () => {
    const r = parseTql(
      '"Story points" >= 3 AND Team = growth AND "Customer facing" = true',
      options,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(JSON.stringify(r.query.where)).toContain('"field":"cf:Story points"');
    // Option values are normalized to the defined spelling.
    expect(JSON.stringify(r.query.where)).toContain('"value":"Growth"');
  });

  it("rejects unknown options and non-numbers", () => {
    expect(parseTql("Team = Sales", options).ok).toBe(false);
    expect(parseTql('"Story points" = lots', options).ok).toBe(false);
    expect(parseTql('"Story points" = 2.5', options).ok).toBe(true);
  });

  it("parses condition functions and filter()", () => {
    const r = parseTql('isStale() AND NOT filter("Open bugs")', options);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.query.where).toMatchObject({
      type: "and",
      left: { type: "call", name: "isStale", builtin: false },
      right: {
        type: "not",
        expr: { type: "call", name: "filter", arg: "Open bugs", builtin: true },
      },
    });
  });

  it("reports unknown functions and missing arguments", () => {
    const unknown = parseTql("nope()", options);
    expect(unknown.ok || unknown.error.message).toContain("isStale()");
    expect(parseTql("filter()", options).ok).toBe(false);
    expect(parseTql("isStale(x)", options).ok).toBe(false);
  });

  it("accepts value-list functions only for their kind", () => {
    expect(parseTql("assignee in frontendTeam()", options).ok).toBe(true);
    expect(parseTql("Reviewer = frontendTeam()", options).ok).toBe(true);
    expect(parseTql("label = frontendTeam()", options).ok).toBe(false);
  });

  it("without options, custom names are unknown", () => {
    expect(parseTql("isStale()").ok).toBe(false);
    expect(parseTql('"Story points" = 3').ok).toBe(false);
  });
});

describe("TQL autocomplete extensions", () => {
  const catalog: TqlCatalog = {
    projects: [],
    statuses: [],
    users: [],
    labels: [],
    sprints: [],
    ...options,
    savedFilters: ["Open bugs"],
  };
  const labels = (input: string) =>
    suggestTql(input, input.length, catalog).items.map((i) => i.label);

  it("offers custom fields and functions at the start of a condition", () => {
    const items = labels("");
    expect(items).toContain("Story points");
    expect(items).toContain("isStale()");
    expect(items).toContain('filter("…")');
  });

  it("offers options, value functions and saved filters", () => {
    expect(labels("Team = ")).toEqual(["Platform", "Growth"]);
    expect(labels("assignee = ")).toContain("frontendTeam()");
    expect(labels("filter(")).toEqual(["Open bugs"]);
    expect(labels('"Story points" ')).toContain(">=");
  });
});

describe("project issue types and releases", () => {
  it("accepts a project's own type names alongside the built-in ones", () => {
    const parsed = parseTql("type in (bug, spike)", { issueTypes: ["Spike"] });
    expect(parsed.ok).toBe(true);
    const bad = parseTql("type = incident", { issueTypes: ["Spike"] });
    expect(bad.ok ? "" : bad.error.message).toContain("Spike");
  });

  it("suggests project types and release names", () => {
    const catalog: TqlCatalog = {
      projects: [],
      statuses: [],
      users: [],
      labels: [],
      sprints: [],
      issueTypes: ["Spike"],
      releases: ["2.0"],
    };
    const values = (q: string) => suggestTql(q, q.length, catalog).items.map((i) => i.label);
    expect(values("type = ")).toContain("Spike");
    expect(values("fixVersion = ")).toEqual(
      expect.arrayContaining(["unreleasedVersions()", "2.0"]),
    );
  });
});
