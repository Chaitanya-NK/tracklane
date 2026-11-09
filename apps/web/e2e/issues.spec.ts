import { expect, test } from "@playwright/test";
import { expectAccessible } from "./fixtures";

test("create an issue, comment on it and resolve it", async ({ page }) => {
  const title = `E2E crash ${Date.now()}`;
  await page.goto("/acme/projects/WEB");
  await page.getByRole("button", { name: "Create issue" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Summary *").fill(title);
  await dialog.getByLabel("Issue type *").click();
  await page.getByRole("option", { name: "Bug" }).click();
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText(/^Created WEB-\d+/)).toBeVisible();

  await page.getByRole("button", { name: "View" }).click();
  await expect(page).toHaveURL(/\/issues\/WEB-\d+/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  const box = page.getByLabel("New comment");
  await box.fill("Reproduced on staging.");
  await page.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(page.getByText("Reproduced on staging.")).toBeVisible();

  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "Done" }).click();
  await page
    .getByRole("dialog", { name: "Resolve issue" })
    .getByRole("button", { name: "Resolve" })
    .click();
  await expect(page.getByLabel("Status")).toContainText("Done");
});

test("the board and issue pages are accessible", async ({ page }) => {
  await page.goto("/acme/projects/WEB/board");
  await expect(page.getByRole("region", { name: "To Do" })).toBeVisible();
  await expectAccessible(page);
  await page.goto("/acme/issues/WEB-1");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectAccessible(page);
});

test("TQL search finds issues", async ({ page }) => {
  await page.goto("/acme/filters");
  await expect(page.getByRole("heading", { name: /Filters|Search/ }).first()).toBeVisible();
  await page.goto("/acme/filters?q=project%20%3D%20WEB%20AND%20type%20%3D%20bug");
  await expect(page.getByRole("link", { name: "WEB-4" }).first()).toBeVisible();
});
