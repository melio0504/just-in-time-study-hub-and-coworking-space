import { expect, test } from "@playwright/test";

test("the landing page presents the primary booking journey", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Just In Time Study Hub/);
  await expect(
    page.getByRole("heading", { level: 1, name: /just in time.*focused success/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /reserve your seat now/i })).toHaveAttribute(
    "href",
    "/reserve",
  );
  await expect(page.getByRole("link", { name: /take a virtual tour/i })).toHaveAttribute(
    "href",
    "/virtual-tour",
  );
});

test("pricing exposes hourly and package options", async ({ page }) => {
  await page.goto("/pricing");

  await expect(
    page.getByRole("heading", { level: 1, name: /simple, affordable rates/i }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hourly Rates" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Package Deals" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Whole day (11hrs & up)" })).toBeVisible();
});

test("an unknown public route uses the branded not-found page", async ({ page }) => {
  const response = await page.goto("/this-route-does-not-exist");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "404" })).toBeVisible();
  await expect(page.getByText(/you've wandered off the study route/i)).toBeVisible();
});
