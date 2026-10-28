import { expect, test, type Page, type Route } from "@playwright/test";

const supabaseCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "apikey, authorization, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
  await page.route("**/rest/v1/announcements*", (route) =>
    fulfillSupabaseJson(route, {
      id: 1,
      status: "published",
      title: "Test announcement",
      body: "The study hub is open today.",
      starts_at: "2026-10-26T00:00:00+08:00",
      created_at: "2026-10-26T00:00:00+08:00",
    }),
  );
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
  const capstoneNotice = page.getByLabel("Capstone project disclaimer");
  await expect(capstoneNotice).toBeVisible();
  await expect(capstoneNotice).toContainText(
    /not the official Just In Time Study Hub.*website/,
  );
  await expect(capstoneNotice).toContainText(
    /payments made here are (?:still )?not official/,
  );
  const announcement = page.getByLabel("Latest announcement");
  await expect(announcement).toBeVisible();
  const headerBox = await page.locator("header.site-header").boundingBox();
  const announcementBox = await announcement.boundingBox();
  expect(headerBox).not.toBeNull();
  expect(announcementBox).not.toBeNull();
  expect(announcementBox!.y).toBeGreaterThanOrEqual(
    headerBox!.y + headerBox!.height + 15,
  );
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

  await page.evaluate(() => window.scrollTo(0, 300));
  await expect(capstoneNotice).not.toBeInViewport();
  await expect
    .poll(async () => {
      const scrolledHeaderBox = await page.locator("header.site-header").boundingBox();
      const scrolledAnnouncementBox = await announcement.boundingBox();
      if (!scrolledHeaderBox || !scrolledAnnouncementBox) return -1;

      return (
        scrolledAnnouncementBox.y -
        (scrolledHeaderBox.y + scrolledHeaderBox.height)
      );
    })
    .toBeGreaterThanOrEqual(15);
});

test("the back-to-top button scrolls gradually", async ({ page }) => {
  await page.route("**/rest/v1/announcements*", (route) =>
    fulfillSupabaseJson(route, []),
  );
  await page.goto("/about");
  await page.waitForTimeout(250);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

  const button = page.getByRole("button", { name: "Scroll to top" });
  await expect(button).toHaveClass(/pointer-events-auto/);
  const start = await page.evaluate(() => window.scrollY);
  expect(start).toBeGreaterThan(320);

  await button.evaluate((element) => element.click());
  await page.waitForTimeout(150);
  const duringAnimation = await page.evaluate(() => window.scrollY);
  expect(duringAnimation).toBeGreaterThan(0);
  expect(duringAnimation).toBeLessThan(start);

  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 2_500 }).toBe(0);
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

test("reserve requires an account before schedule and seat selection", async ({ page }) => {
  await page.route("**/auth/v1/user*", (route) =>
    fulfillSupabaseJson(route, {
      code: "session_not_found",
      message: "Auth session missing",
    }, 401),
  );
  await page.route("**/rest/v1/business_hours*", (route) =>
    fulfillSupabaseJson(route, []),
  );
  await page.route("**/rest/v1/business_closures*", (route) =>
    fulfillSupabaseJson(route, []),
  );
  await page.route("**/rest/v1/booking_settings*", (route) =>
    fulfillSupabaseJson(route, {
      max_seats_per_booking: 5,
      min_duration_hours: 1,
      max_duration_hours: 8,
      minimum_notice_minutes: 60,
      maximum_advance_days: 90,
    }),
  );
  await page.route("**/rest/v1/rpc/get_available_seats*", (route) =>
    fulfillSupabaseJson(route, []),
  );

  await page.goto("/reserve");

  const notice = page.getByRole("status").filter({
    hasText: "Sign in to reserve a seat",
  });
  await expect(notice).toBeVisible();
  await expect(notice.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/register",
  );
  await expect(page.getByRole("button", { name: "Select Date" })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Time" })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Duration" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "SO01" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Confirm Reservation" })).toBeDisabled();
});

test("an unknown public route uses the branded not-found page", async ({ page }) => {
  const response = await page.goto("/this-route-does-not-exist");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "404" })).toBeVisible();
  await expect(page.getByText(/you've wandered off the study route/i)).toBeVisible();
});
