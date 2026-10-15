import { withSupabase } from "@supabase/server";

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }

    const userId = context.userClaims!.id;
    const adminClient = context.supabaseAdmin;
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return json({ error: "Your customer account could not be verified." }, 403);
    }
    if (profile.role !== "customer") {
      return json({ error: "Employee accounts cannot be deleted from the customer portal." }, 403);
    }

    const { data: activeReservation, error: reservationError } = await adminClient
      .from("bookings")
      .select("id")
      .eq("user_id", userId)
      .in("status", ["pending", "confirmed", "checked_in"])
      .limit(1)
      .maybeSingle();

    if (reservationError) {
      console.error("Active reservation lookup failed", reservationError.code, reservationError.message);
      return json({ error: "Your reservations could not be checked. Please try again." }, 500);
    }
    if (activeReservation) {
      return json({
        error: "Cancel or complete your active reservations before deleting your account.",
      }, 409);
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId, false);
    if (deleteError) {
      console.error("Customer account deletion failed", deleteError.status, deleteError.message);
      return json({
        error: "Your account could not be deleted. Please try again or contact the front desk.",
      }, 500);
    }

    return json({ deleted: true });
  }),
};
