import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";
import { getSupabaseConfig, SUPABASE_AUTH_COOKIE_NAME } from "./config";

export function createClient() {
  const { supabaseUrl, supabasePublishableKey } = getSupabaseConfig();

  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookieOptions: { name: SUPABASE_AUTH_COOKIE_NAME },
  });
}
