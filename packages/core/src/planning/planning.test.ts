import { describe, expect, it } from "vitest";
import { describeRecurrence, layoutDependencies, nextRun, releaseNotes } from "./index";

const at = (iso: string) => new Date(`${iso}T15:00:00Z`);
const day = (d: Date) => d.toISOString().slice(0, 10);

describe("recurrence", () => {
  it("finds the next matching day", () => {
    // 2026-11-09 is a Monday.
    expect(day(nextRun("daily", [], at("2026-11-09")))).toBe("2026-11-10");
    expect(day(nextRun("weekly", [1, 4], at("2026-11-09")))).toBe("2026-11-12");
    expect(day(nextRun("weekly", [1], at("2026-11-09")))).toBe("2026-11-16");
    expect(day(nextRun("monthly", [31], at("2026-11-09")))).toBe("2026-11-30");
    expect(day(nextRun("monthly", [1], at("2026-11-30")))).toBe("2026-12-01");
    expect(describeRecurrence("weekly", [4, 1])).toBe("Weekly on Mon, Thu");
  });
});

describe("dependency layout", () => {
  it("layers chains and reports cycles", () => {
    const g = layoutDependencies(
      [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
      [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
        { from: "a", to: "c" },
        { from: "c", to: "a" },
      ],
    );
    const layer = Object.fromEntries(g.nodes.map((n) => [n.id, n.layer]));
    expect(layer).toEqual({ a: 0, b: 1, c: 2, d: 0 });
    expect(g.cycles).toEqual([{ from: "c", to: "a" }]);
    expect(g.layers).toBe(3);
  });
});

describe("release notes", () => {
  it("groups resolved issues and lists known issues", () => {
    const md = releaseNotes({
      projectName: "Web",
      release: { name: "1.2", description: "", releaseDate: "2026-11-20" },
      issues: [
        { key: "W-1", title: "Dark mode", type: "story", done: true },
        { key: "W-2", title: "Crash on save", type: "bug", done: true },
        { key: "W-3", title: "Slow search", type: "bug", done: false },
      ],
    });
    expect(md).toContain("## New features\n- Dark mode (W-1)");
    expect(md).toContain("## Bug fixes\n- Crash on save (W-2)");
    expect(md).toContain("## Known issues\n- Slow search (W-3, bug)");
  });
});
