import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig, SUPABASE_AUTH_COOKIE_NAME } from "./config";
import type { Database } from "./database.types";

export function createClient() {
  const { supabaseUrl, supabasePublishableKey } = getSupabaseConfig();

  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookieOptions: { name: SUPABASE_AUTH_COOKIE_NAME },
  });
}
