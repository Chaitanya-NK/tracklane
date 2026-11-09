import { expect, test } from "@playwright/test";
import { DEMO, expectAccessible } from "./fixtures";

test("sign-in offers Google, GitHub and SSO", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("button", { name: "Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "GitHub" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in with SSO" }).click();
  await expect(page.getByRole("dialog")).toContainText("Single sign-on is coming soon");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expectAccessible(page);
});

test("a wrong password is rejected", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(DEMO.email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Wrong email or password.")).toBeVisible();
});

test("signed-out visitors are sent to sign-in", async ({ page }) => {
  await page.goto("/acme/projects");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("security headers are set", async ({ request }) => {
  const res = await request.get("/sign-in");
  const headers = res.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("the app is installable", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect((await request.get("/offline.html")).ok()).toBe(true);
  expect((await request.get("/sw.js")).ok()).toBe(true);
});
