import { expect, test as setup } from "@playwright/test";
import { DEMO } from "./fixtures";

setup("sign in as the demo user", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(DEMO.email);
  await page.getByLabel("Password").fill(DEMO.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/acme/);
  await page.context().storageState({ path: "e2e/.auth/demo.json" });
});
