import { describe, expect, it } from "vitest";
import { currentOrder, withOrderBy } from "../sort";

describe("ORDER BY helpers", () => {
  it("adds or replaces the ORDER BY clause", () => {
    expect(withOrderBy("type = bug", "priority", "desc")).toBe("type = bug ORDER BY priority DESC");
    expect(withOrderBy("type = bug order by created", "key", "asc")).toBe(
      "type = bug ORDER BY key ASC",
    );
    expect(withOrderBy("", "due", "asc")).toBe("ORDER BY due ASC");
  });
  it("reads the current order", () => {
    expect(currentOrder("x ORDER BY Priority desc, key")).toEqual({
      field: "priority",
      direction: "desc",
    });
    expect(currentOrder("type = bug")).toBeNull();
  });
});
