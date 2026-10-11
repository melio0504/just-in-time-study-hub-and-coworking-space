import { withSupabase } from "@supabase/server";

// Kept as a deployed compatibility stub. Only the signed PayMongo webhook may
// transition a paid reservation to confirmed.
export default {
  fetch: withSupabase({ auth: "none" }, async () => Response.json({
    error: "The payment simulator was retired. This reservation must be confirmed by PayMongo.",
  }, { status: 410 })),
};
