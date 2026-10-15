import { withSupabase } from "@supabase/server";
import QRCode from "qrcode";

const encoder = new TextEncoder();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
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
    if (!uuidPattern.test(bookingId)) return json({ error: "Invalid reservation." }, 400);

    const secret = Deno.env.get("QR_ACCESS_TOKEN_SECRET")?.trim();
    if (!secret || secret.length < 32) return json({ error: "QR-pass delivery is not configured." }, 503);

    const { data, error } = await context.supabaseAdmin.rpc("get_customer_booking_pass", {
      p_booking_id: bookingId,
      p_user_id: context.userClaims!.id,
    });
    if (error) return json({ error: error.message }, 500);
    const pass = data?.[0];
    if (!pass) return json({ error: "A kiosk QR pass was not found for this reservation." }, 404);

    const token = base64Url(await hmac(`booking:${bookingId}:access-pass:v1`, secret));
    const qrImage = await QRCode.toDataURL(`JITPASS:${token}`, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 640,
    });
    return json({
      reservationCode: pass.reservation_code,
      expiresAt: pass.expires_at,
      qrImage,
    });
  }),
};
