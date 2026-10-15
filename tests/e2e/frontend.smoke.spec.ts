import { expect, test, type Page, type Route } from "@playwright/test";

const supabaseCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "apikey, authorization, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Range",
};

async function fulfillSupabaseJson(route: Route, body: unknown, status = 200) {
  if (route.request().method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers: supabaseCorsHeaders });
    return;
  }

  await route.fulfill({
    status,
    contentType: "application/json",
    headers: supabaseCorsHeaders,
    body: JSON.stringify(body),
  });
}

async function mockPublicSupabaseContext(page: Page) {
  await page.route("**/rest/v1/business_hours*", (route) =>
    fulfillSupabaseJson(route, null),
  );
}

test("the landing page presents the primary booking journey", async ({ page }) => {
  const response = await page.goto("/");

  expect(response).not.toBeNull();
  const headers = response!.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("frame-src https://www.google.com");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("no-referrer");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["x-powered-by"]).toBeUndefined();
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
  await mockPublicSupabaseContext(page);
  await page.route("**/rest/v1/service_rate_plans*", (route) => fulfillSupabaseJson(route, [
    {
      id: 1,
      code: "whole-day",
      name: "Whole day",
      price_cents: 37000,
      is_active: true,
      sort_order: 90,
    },
  ]));
  await page.route("**/rest/v1/package_rate_plans*", (route) => fulfillSupabaseJson(route, [
    {
      id: 1,
      name: "5-Day Pass",
      price_cents: 150000,
      validity_days: 30,
      is_popular: true,
      is_active: true,
      sort_order: 10,
    },
  ]));
  await page.route("**/rest/v1/business_closures*", (route) => fulfillSupabaseJson(route, []));
  await page.goto("/pricing");

  await expect(
    page.getByRole("heading", { level: 1, name: /simple, affordable rates/i }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hourly Rates" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Package Deals" })).toBeVisible();
  await expect(page.getByText("Whole day", { exact: true })).toBeVisible();
  await expect(page.getByText("5-Day Pass", { exact: true })).toBeVisible();
});

test("pricing explains when current rates are unavailable", async ({ page }) => {
  await mockPublicSupabaseContext(page);
  for (const table of ["service_rate_plans", "package_rate_plans", "business_closures"]) {
    await page.route(`**/rest/v1/${table}*`, (route) =>
      fulfillSupabaseJson(route, {
        code: "PGRST000",
        details: null,
        hint: null,
        message: "Temporarily unavailable",
      }, 400),
    );
  }

  await page.goto("/pricing");

  await expect(
    page.getByRole("alert").filter({
      hasText: "couldn't load all current pricing information",
    }),
  ).toBeVisible();
  await expect(page.getByText(/No hourly rates are currently available/i)).toBeVisible();
  await expect(page.getByText(/No package deals are currently available/i)).toBeVisible();
});

test("an unknown public route uses the branded not-found page", async ({ page }) => {
  const response = await page.goto("/this-route-does-not-exist");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "404" })).toBeVisible();
  await expect(page.getByText(/you've wandered off the study route/i)).toBeVisible();
});
