import { withSupabase } from "@supabase/server";
import QRCode from "qrcode";

const encoder = new TextEncoder();

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function confirmationBaseUrl(request: Request, supplied: unknown) {
  const configured = Deno.env.get("BOOKING_CONFIRMATION_URL")?.trim();
  const candidate = configured || (typeof supplied === "string" ? supplied.trim() : "") ||
    request.headers.get("origin") || "";

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Set BOOKING_CONFIRMATION_URL to the public or LAN URL of the customer app.");
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error("BOOKING_CONFIRMATION_URL must be an HTTP or HTTPS origin.");
  }
  return url.origin;
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

    let body: { bookingId?: unknown; confirmationBaseUrl?: unknown };
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid request body." }, 400);
    }

    const bookingId = typeof body.bookingId === "string" ? body.bookingId : "";
    if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return json({ error: "Invalid booking." }, 400);

    const userId = context.userClaims!.id;
    const { error: emailSyncError } = await context.supabaseAdmin.rpc("sync_booking_account_email", {
      p_booking_id: bookingId,
      p_user_id: userId,
    });
    if (emailSyncError) {
      console.error("Booking email synchronization failed", emailSyncError.code, emailSyncError.message);
      return json({ error: emailSyncError.message }, emailSyncError.code === "P0002" ? 404 : 500);
    }

    const token = randomToken();
    const { error } = await context.supabaseAdmin.rpc("create_booking_confirmation_token", {
      p_booking_id: bookingId,
      p_user_id: userId,
      p_token_hash: await sha256(token),
    });
    if (error) {
      console.error("Local confirmation token creation failed", error.code, error.message);
      const status = error.code === "P0002" ? 404 : error.code === "P0001" ? 409 : 500;
      return json({ error: error.message }, status);
    }

    let baseUrl: string;
    try {
      baseUrl = confirmationBaseUrl(request, body.confirmationBaseUrl);
    } catch (urlError) {
      return json({ error: urlError instanceof Error ? urlError.message : "Invalid confirmation URL." }, 503);
    }

    const confirmationUrl = new URL("/reservation/confirm", baseUrl);
    confirmationUrl.searchParams.set("token", token);
    const qrDataUrl = await QRCode.toDataURL(confirmationUrl.toString(), {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 480,
    });

    return json({
      qrDataUrl,
      confirmationUrl: confirmationUrl.toString(),
      expiresInSeconds: 15 * 60,
    }, 201);
  }),
};
