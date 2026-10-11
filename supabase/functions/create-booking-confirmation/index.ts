import { withSupabase } from "@supabase/server";

// Kept as a deployed compatibility stub so an older client cannot use the
// former simulated-payment flow to confirm a reservation without PayMongo.
export default {
  fetch: withSupabase({ auth: "user" }, async () => Response.json({
    error: "The payment simulator was retired. Generate a PayMongo QR Ph code instead.",
  }, { status: 410 })),
};
