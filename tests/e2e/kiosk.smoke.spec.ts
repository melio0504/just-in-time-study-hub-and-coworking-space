import { expect, test } from "@playwright/test";

test("the local kiosk opens directly to the QR scanner", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Facility Kiosk.*Just In Time Study Hub/);
  await expect(page.getByRole("heading", { name: /Scan your QR pass/i })).toBeVisible();
  await expect(page.getByText("Facility Kiosk")).toBeVisible();
  await expect(page.getByAltText("Just In Time Study Hub and Coworking Space")).toBeVisible();
  await expect(page.getByText("Authorized operator")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /minimize kiosk/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /full screen/i })).toHaveCount(0);

  for (const viewport of [
    { width: 960, height: 640 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    const camera = await page.getByTestId("camera-frame").boundingBox();
    expect(camera).not.toBeNull();
    expect(camera!.x).toBeGreaterThanOrEqual(0);
    expect(camera!.y).toBeGreaterThanOrEqual(0);
    expect(camera!.x + camera!.width).toBeLessThanOrEqual(viewport.width);
    expect(camera!.y + camera!.height).toBeLessThanOrEqual(viewport.height);
  }
});
