const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Cookies are shared by hostname, not port. Use an app-specific name so the
// local admin session on :3001 stays separate from the public app on :3000.
export const SUPABASE_AUTH_COOKIE_NAME = "jit-admin-auth";

function isAllowedSupabaseUrl(value: string | undefined) {
  if (!value) return false;

  try {
    const url = new URL(value);
    const isLoopbackHost =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]";
    const octets = url.hostname.split(".").map(Number);
    const isPrivateIpv4 = octets.length === 4 && octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) && (
      octets[0] === 10 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168)
    );
    const allowInsecureLan = process.env.NEXT_PUBLIC_ALLOW_INSECURE_LAN === "true";

    return url.protocol === "https:" ||
      (url.protocol === "http:" && (isLoopbackHost || (allowInsecureLan && isPrivateIpv4)));
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
