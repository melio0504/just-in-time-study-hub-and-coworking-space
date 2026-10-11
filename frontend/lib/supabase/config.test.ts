import { afterEach, describe, expect, it, vi } from "vitest";

const URL_ENV = "NEXT_PUBLIC_SUPABASE_URL";
const KEY_ENV = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

async function loadConfig(url: string) {
  vi.stubEnv(URL_ENV, url);
  vi.stubEnv(KEY_ENV, "test-publishable-key");
  vi.resetModules();
  return import("./config");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Supabase browser configuration", () => {
  it.each(["http://localhost:54321", "http://127.0.0.1:54321", "https://example.supabase.co"])(
    "accepts a safe URL (%s)",
    async (url) => {
      const config = await loadConfig(url);
      expect(config.isSupabaseConfigured).toBe(true);
      expect(config.getSupabaseConfig()).toEqual({
        supabaseUrl: url,
        supabasePublishableKey: "test-publishable-key",
      });
    },
  );

  it.each(["http://192.168.1.20:54321", "http://supabase.example.com", "not-a-url", "https://your-project-ref.supabase.co"])(
    "rejects unsafe or placeholder URLs (%s)",
    async (url) => {
      const config = await loadConfig(url);
      expect(config.isSupabaseConfigured).toBe(false);
      expect(() => config.getSupabaseConfig()).toThrow("Supabase is not configured");
    },
  );
});
