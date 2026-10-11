import { afterEach, describe, expect, it, vi } from "vitest";

const URL_ENV = "NEXT_PUBLIC_SUPABASE_URL";
const KEY_ENV = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

async function loadConfig(url: string, key = "test-publishable-key") {
  vi.stubEnv(URL_ENV, url);
  vi.stubEnv(KEY_ENV, key);
  vi.resetModules();
  return import("./config");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("admin Supabase configuration", () => {
  it.each(["http://localhost:54321", "http://127.0.0.1:54321", "https://example.supabase.co"])(
    "accepts a safe URL (%s)",
    async (url) => {
      const config = await loadConfig(url);

      expect(config.isSupabaseConfigured).toBe(true);
      expect(config.SUPABASE_AUTH_COOKIE_NAME).toBe("jit-admin-auth");
      expect(config.getSupabaseConfig()).toEqual({
        supabaseUrl: url,
        supabasePublishableKey: "test-publishable-key",
      });
    },
  );

  it.each([
    ["http://10.0.0.8:54321", "test-publishable-key"],
    ["http://supabase.example.com", "test-publishable-key"],
    ["not-a-url", "test-publishable-key"],
    ["https://your-project-ref.supabase.co", "test-publishable-key"],
    ["https://example.supabase.co", "your_key"],
    ["https://example.supabase.co", ""],
  ])("rejects incomplete or unsafe settings (%s)", async (url, key) => {
    const config = await loadConfig(url, key);

    expect(config.isSupabaseConfigured).toBe(false);
    expect(() => config.getSupabaseConfig()).toThrow("Supabase is not configured");
  });
});
