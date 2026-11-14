import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const DEMO = { email: "demo@tracklane.dev", password: "tracklane-demo" };

/** Fails on serious or critical WCAG 2 A/AA violations. */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    // Toasts fade in and out; mid-animation opacity reads as low contrast.
    .exclude("[data-sonner-toaster]")
    .analyze();
  const serious = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id}: ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(", ")}`,
    );
  expect(serious, "accessibility violations").toEqual([]);
}
