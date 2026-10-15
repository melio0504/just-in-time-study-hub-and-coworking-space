import { expect, test } from "@playwright/test";

test("the operations portal renders its sign-in form", async ({ page }) => {
  const response = await page.goto("/");

  expect(response).not.toBeNull();
  const headers = response!.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("no-referrer");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["x-powered-by"]).toBeUndefined();

  await expect(page).toHaveTitle(/Admin.*Just In Time Study Hub/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Administrator Access" }),
  ).toBeVisible();
  await expect(page.locator('input[name="email"]')).toHaveAttribute("type", "email");
  await expect(page.locator('input[name="password"]')).toHaveAttribute("type", "password");
  await expect(page.getByRole("button", { name: "Sign In to Admin Portal" })).toBeVisible();
});

test("every protected admin route redirects to the root sign-in", async ({ page }) => {
  const protectedRoutes = [
    "/dashboard",
    "/walk-ins",
    "/reservations",
    "/cms",
    "/announcements",
    "/analytics",
    "/staffs",
    "/logs",
  ];

  for (const route of protectedRoutes) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Admin Sign In" })).toBeVisible();
  }
});

test("the legacy admin URL redirects to the root sign-in", async ({ page }) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Admin Sign In" })).toBeVisible();
});
