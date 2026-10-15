import { withSupabase } from "@supabase/server";
import { sendBookingConfirmationEmail } from "../_shared/booking-confirmation-email.ts";

const encoder = new TextEncoder();

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function base64Url(bytes: ArrayBuffer) {
  let binary = "";
  for (const value of new Uint8Array(bytes)) binary += String.fromCharCode(value);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, encoder.encode(value));
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

    let body: { bookingId?: unknown };
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid request body." }, 400);
    }

    const bookingId = typeof body.bookingId === "string" ? body.bookingId.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookingId)) {
      return json({ error: "Invalid reservation." }, 400);
    }

    const accessSecret = Deno.env.get("QR_ACCESS_TOKEN_SECRET")?.trim();
    if (!accessSecret || accessSecret.length < 32) {
      console.error("QR_ACCESS_TOKEN_SECRET is missing or shorter than 32 characters.");
      return json({ error: "QR-pass delivery is not configured." }, 503);
    }

    const { data, error } = await context.supabaseAdmin.rpc("prepare_booking_pass_resend", {
      p_booking_id: bookingId,
      p_user_id: context.userClaims!.id,
    });
    if (error) {
      const status = error.code === "P0002" ? 404 : error.code === "P0001" ? 429 : 500;
      return json({ error: error.message }, status);
    }

    const booking = data?.[0];
    if (!booking) return json({ error: "The QR pass could not be prepared." }, 500);

    try {
      const accessToken = base64Url(await hmac(`booking:${bookingId}:access-pass:v1`, accessSecret));
      const sendMinute = Math.floor(Date.now() / 60_000);
      await sendBookingConfirmationEmail(booking, accessToken, {
        resend: true,
        idempotencyKey: `booking-pass-resend/${bookingId}/${sendMinute}`,
      });
      const { error: markError } = await context.supabaseAdmin.rpc("mark_booking_confirmation_email", {
        p_booking_id: bookingId,
        p_error: null,
      });
      if (markError) throw new Error(markError.message);
      return json({ sent: true, email: booking.guest_email });
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "Email delivery failed.";
      console.error("QR-pass resend failed", message);
      await context.supabaseAdmin.rpc("mark_booking_confirmation_email", {
        p_booking_id: bookingId,
        p_error: message.slice(0, 1000),
      });
      return json({ error: "The QR pass could not be emailed. Please try again later." }, 502);
    }
  }),
};
