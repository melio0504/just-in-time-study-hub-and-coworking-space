const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Cookies are shared by hostname, not port. Use an app-specific name so a
// session created by the local admin app on :3001 is not visible on :3000.
export const SUPABASE_AUTH_COOKIE_NAME = "jit-frontend-auth";

function isAllowedSupabaseUrl(value: string | undefined) {
  if (!value) return false;

  try {
    const url = new URL(value);
    const isLoopbackHost =
      url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";

    return url.protocol === "https:" || (url.protocol === "http:" && isLoopbackHost);
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabasePublishableKey &&
    isAllowedSupabaseUrl(supabaseUrl) &&
    !supabaseUrl.includes("your-project-ref") &&
    !supabasePublishableKey.includes("your_key"),
);

export function getSupabaseConfig() {
  if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.",
    );
  }

  return { supabaseUrl, supabasePublishableKey };
}
