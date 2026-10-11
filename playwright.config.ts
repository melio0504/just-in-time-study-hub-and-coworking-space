import { defineConfig, devices } from "@playwright/test";

const localExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    launchOptions: localExecutable ? { executablePath: localExecutable } : undefined,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: localExecutable ? "off" : "retain-on-failure",
  },
  projects: [
    {
      name: "frontend",
      testMatch: /frontend\.smoke\.spec\.ts/,
      use: { baseURL: "http://127.0.0.1:3000" },
    },
    {
      name: "admin",
      testMatch: /admin\.smoke\.spec\.ts/,
      use: { baseURL: "http://127.0.0.1:3001" },
    },
  ],
  webServer: [
    {
      command: "npm run dev:frontend",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "e2e-publishable-key",
      },
    },
    {
      command: "npm run dev:admin",
      url: "http://127.0.0.1:3001/admin",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      },
    },
  ],
});
