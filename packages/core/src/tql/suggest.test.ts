import { describe, expect, it } from "vitest";
import { suggestTql, type TqlCatalog } from "./suggest";

const catalog: TqlCatalog = {
  projects: [{ key: "WEB", name: "Web Platform" }],
  statuses: ["To Do", "In Progress", "Done"],
  users: [{ name: "Priya Raman", email: "priya@tracklane.dev" }],
  labels: ["frontend", "backend"],
  sprints: ["WEB Sprint 2"],
};
const labels = (input: string, cursor = input.length) =>
  suggestTql(input, cursor, catalog).items.map((i) => i.label);

describe("suggestTql", () => {
  it("suggests fields at the start and after AND", () => {
    expect(labels("")).toContain("project");
    expect(labels("sta")).toEqual(["status", "statusCategory", "start"]);
    expect(labels("type = bug AND assi")).toEqual(["assignee"]);
  });

  it("suggests operators after a field", () => {
    expect(labels("summary ")).toEqual(["~", "!~"]);
    expect(labels("assignee ")).toContain("IS EMPTY");
  });

  it("suggests values from the catalog and enums", () => {
    expect(labels("status = ")).toEqual(["To Do", "In Progress", "Done"]);
    expect(labels("assignee = ")).toEqual(["currentUser()", "Priya Raman"]);
    expect(labels("priority = hi")).toEqual(["high", "highest"]);
    expect(labels('status in ("To Do", ')).toContain("Done");
    expect(suggestTql('status = "In P', 14, catalog)).toMatchObject({
      from: 9,
      items: [{ insert: '"In Progress"' }],
    });
  });

  it("suggests connectives and ORDER BY fields", () => {
    expect(labels("type = bug ")).toEqual(["AND", "OR", "ORDER BY"]);
    expect(labels("type = bug ORDER BY ")).toContain("priority");
    expect(labels("type = bug ORDER BY priority ")).toEqual(["ASC", "DESC"]);
  });
});
