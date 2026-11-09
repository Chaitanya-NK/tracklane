import { describe, expect, it } from "vitest";
import { parseWidgets, widgetNeeds } from "../widgets";

describe("dashboard widgets", () => {
  it("keeps valid widgets and drops broken ones", () => {
    const widgets = parseWidgets([
      { id: "a", title: "Open", size: "half", type: "count", config: { query: "type = bug" } },
      { id: "b", title: "Bad", size: "huge", type: "count", config: {} },
      "nonsense",
    ]);
    expect(widgets.map((w) => w.id)).toEqual(["a"]);
    expect(parseWidgets(null)).toEqual([]);
  });

  it("knows what each type needs", () => {
    expect(widgetNeeds("breakdown")).toEqual({ query: true, project: false });
    expect(widgetNeeds("burndown")).toEqual({ query: false, project: true });
  });
});
