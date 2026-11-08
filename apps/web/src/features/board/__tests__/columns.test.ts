import { describe, expect, it } from "vitest";
import { findColumn, moveItem, neighboursOf } from "../columns";

const columns = { todo: ["a", "b"], doing: ["c"], done: [] as string[] };

describe("board columns", () => {
  it("finds the column of an item or a column id", () => {
    expect(findColumn(columns, "c")).toBe("doing");
    expect(findColumn(columns, "done")).toBe("done");
    expect(findColumn(columns, "zzz")).toBeUndefined();
  });

  it("moves between columns without mutating the input", () => {
    const next = moveItem(columns, "a", "done");
    expect(next).toEqual({ todo: ["b"], doing: ["c"], done: ["a"] });
    expect(columns.todo).toEqual(["a", "b"]);
  });

  it("moves within a column to an index", () => {
    expect(moveItem(columns, "b", "todo", 0).todo).toEqual(["b", "a"]);
    expect(moveItem(columns, "a", "doing", 0).doing).toEqual(["a", "c"]);
  });

  it("reports neighbours for ranking", () => {
    const next = moveItem(columns, "c", "todo", 1);
    expect(neighboursOf(next, "c")).toEqual({ beforeId: "a", afterId: "b" });
    expect(neighboursOf(next, "a")).toEqual({ beforeId: null, afterId: "c" });
  });
});
