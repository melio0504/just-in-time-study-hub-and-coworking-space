import { expect, test } from "@playwright/test";

test("the operations portal renders its sign-in form", async ({ page }) => {
  await page.goto("/admin");

  await expect(page).toHaveTitle(/Admin.*Just In Time Study Hub/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Administrator Access" }),
  ).toBeVisible();
  await expect(page.locator('input[name="email"]')).toHaveAttribute("type", "email");
  await expect(page.locator('input[name="password"]')).toHaveAttribute("type", "password");
  await expect(page.getByRole("button", { name: "Sign In to Admin Portal" })).toBeVisible();
});

test("protected dashboard routes redirect to sign-in without configuration", async ({ page }) => {
  await page.goto("/admin/dashboard");

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Admin Sign In" })).toBeVisible();
});
