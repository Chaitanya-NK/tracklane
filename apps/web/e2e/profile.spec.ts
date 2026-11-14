import { expect, test } from "@playwright/test";
import { expectAccessible } from "./fixtures";

test("edit your profile from the user menu", async ({ page }) => {
  await page.goto("/acme/profile");
  await expect(page).toHaveURL(/\/acme\/people\//);
  await page.getByRole("button", { name: "Edit profile" }).click();
  const dialog = page.getByRole("dialog");
  const title = `Engineer ${Date.now() % 1000}`;
  await dialog.getByLabel("Job title").fill(title);
  await dialog.getByRole("combobox").click();
  await page.getByPlaceholder("Search time zones").fill("Kolkata");
  await page.getByRole("option", { name: /^Asia\/Kolkata/ }).click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(title)).toBeVisible();
  await expect(page.getByText(/local time/)).toBeVisible();
  await expectAccessible(page);

  await page.getByRole("tab", { name: "Activity" }).click();
  await expect(page).toHaveURL(/tab=activity/);
});

test("project public pages can be toggled", async ({ page }) => {
  await page.goto("/acme/projects/WEB/settings");
  const toggle = page.getByRole("switch", { name: "Public roadmap" });
  const before = await toggle.getAttribute("aria-checked");
  await toggle.click();
  await expect(page.getByText(/Roadmap is (public|private)/)).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-checked", before === "true" ? "false" : "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", before ?? "false");
});
