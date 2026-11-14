import { expect, test } from "@playwright/test";
import { expectAccessible } from "./fixtures";

test("account settings list this session", async ({ page }) => {
  await page.goto("/acme/settings/account");
  await expect(page.getByText("This device")).toBeVisible();
  await expect(page.getByRole("button", { name: "Change password" })).toBeVisible();
  await expectAccessible(page);
});

test("role changes show up in the audit log and its CSV export", async ({ page }) => {
  await page.goto("/acme/settings/members");
  const trigger = page.getByRole("combobox", { name: /^Role for/ }).first();
  // The selected value renders after hydration; read it only once it's there.
  await expect(trigger).toHaveText(/\S/);
  const current = (await trigger.innerText()).trim();
  await trigger.click();
  const options = (await page.getByRole("option").allInnerTexts()).map((o) => o.trim());
  const next =
    options.find((o) => o !== current && o !== "Owner") ?? options.find((o) => o !== current)!;
  await page.getByRole("option", { name: next }).click();
  await expect(trigger).toContainText(next);

  await page.goto("/acme/settings/audit?category=members");
  await expect(
    page.getByRole("table", { name: "Audit events" }).getByText("Changed a member's role").first(),
  ).toBeVisible();
  await expectAccessible(page);

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  const file = await (await download).path();
  const { readFile } = await import("node:fs/promises");
  const csv = await readFile(file, "utf8");
  expect(csv.split("\n")[0]).toContain("Time (UTC),Actor,Action");
  expect(csv).toContain("member.role_changed");
});
