import { withSupabase } from "@supabase/server";
import QRCode from "qrcode";

const encoder = new TextEncoder();

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
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

async function sha256(value: string) {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]!);
}

function formatManila(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

async function sendConfirmationEmail(booking: Record<string, unknown>, accessToken: string) {
  const qrDataUrl = await QRCode.toDataURL(`JITPASS:${accessToken}`, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 480,
  });
  const qrBase64 = qrDataUrl.split(",", 2)[1];
  const seats = (booking.seat_ids as string[]).join(", ");
  const email = {
    to: String(booking.guest_email),
    subject: `Reservation confirmed — ${booking.reservation_code}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#2d2520">
        <h1 style="color:#b57b12">Reservation confirmed</h1>
        <p>Hello ${escapeHtml(String(booking.guest_name))},</p>
        <p>Your Just In Time Study Hub reservation is confirmed.</p>
        <div style="background:#fff8ed;border:1px solid #eadfce;border-radius:16px;padding:20px">
          <p><strong>Reservation:</strong> ${escapeHtml(String(booking.reservation_code))}</p>
          <p><strong>Seats:</strong> ${escapeHtml(seats)}</p>
          <p><strong>Starts:</strong> ${escapeHtml(formatManila(String(booking.starts_at)))}</p>
          <p><strong>Ends:</strong> ${escapeHtml(formatManila(String(booking.ends_at)))}</p>
        </div>
        <h2>Your kiosk access pass</h2>
        <p>Show this QR code at the facility kiosk. Scan once to check in and scan it again to check out.</p>
        <p style="text-align:center"><img src="cid:booking-access-qr" width="280" height="280" alt="Booking access QR code"></p>
        <p style="font-size:13px;color:#6b5e52">Do not share this QR code. It grants access to your reservation.</p>
      </div>`,
    attachment: {
      filename: `reservation-${booking.reservation_code}.png`,
      content: qrBase64,
      contentType: "image/png",
      contentId: "booking-access-qr",
    },
  };
  const provider = (Deno.env.get("EMAIL_PROVIDER") ?? "mailpit").trim().toLowerCase();
  const fromEmail = Deno.env.get("EMAIL_FROM") ?? Deno.env.get("RESEND_FROM_EMAIL") ??
    "Just In Time Study Hub <bookings@local.test>";

  if (provider === "mailpit") {
    const senderMatch = fromEmail.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
    const sender = senderMatch
      ? { Name: senderMatch[1], Email: senderMatch[2] }
      : { Email: fromEmail.trim() };
    const response = await fetch(Deno.env.get("MAILPIT_API_URL") ?? "http://inbucket:8025/api/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: sender,
        To: [{ Email: email.to }],
        Subject: email.subject,
        HTML: email.html,
        Tags: ["booking-confirmation"],
        Attachments: [{
          Filename: email.attachment.filename,
          Content: email.attachment.content,
          ContentType: email.attachment.contentType,
          ContentID: email.attachment.contentId,
        }],
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Mailpit rejected the confirmation email (${response.status}): ${detail.slice(0, 300)}`);
    }
    return;
  }

  if (provider !== "resend") throw new Error(`Unsupported EMAIL_PROVIDER: ${provider}`);
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) throw new Error("RESEND_API_KEY is required when EMAIL_PROVIDER=resend.");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `booking-confirmation/${booking.booking_id}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      attachments: [{
        filename: email.attachment.filename,
        content: email.attachment.content,
        content_type: email.attachment.contentType,
        content_id: email.attachment.contentId,
      }],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend rejected the confirmation email (${response.status}): ${detail.slice(0, 300)}`);
  }
}

export default {
  fetch: withSupabase({ auth: "none" }, async (request, context) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

    let body: { token?: unknown; action?: unknown };
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid request body." }, 400);
    }
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!/^[A-Za-z0-9_-]{40,128}$/.test(token)) return json({ error: "Invalid confirmation token." }, 400);
    const action = body.action === "preview" ? "preview" : body.action === "confirm" || body.action == null
      ? "confirm"
      : "invalid";
    if (action === "invalid") return json({ error: "Invalid confirmation action." }, 400);

    const tokenHash = await sha256(token);
    if (action === "preview") {
      const { data, error } = await context.supabaseAdmin.rpc("get_booking_confirmation_preview", {
        p_token_hash: tokenHash,
      });
      if (error) {
        console.error("Booking payment preview failed", error.code, error.message);
        const status = error.code === "P0001" || error.code === "P0002" ? 404 : 500;
        return json({ error: error.message }, status);
      }

      const booking = data?.[0];
      if (!booking) return json({ error: "This payment link is invalid or has expired." }, 404);
      return json({
        reservationCode: booking.reservation_code,
        guestName: booking.guest_name,
        guestEmail: booking.guest_email,
        startsAt: booking.starts_at,
        endsAt: booking.ends_at,
        seats: booking.seat_ids,
        subtotalCents: booking.subtotal_cents,
        expiresAt: booking.expires_at,
        confirmed: booking.confirmed,
      });
    }

    const accessSecret = Deno.env.get("QR_ACCESS_TOKEN_SECRET");
    if (!accessSecret || accessSecret.length < 32) {
      return json({ error: "QR access passes are not configured." }, 503);
    }

    const accessToken = base64Url(await hmac(`${token}:access-pass`, accessSecret));
    const { data, error } = await context.supabaseAdmin.rpc("confirm_booking_from_token", {
      p_token_hash: tokenHash,
      p_access_token_hash: await sha256(accessToken),
    });
    if (error) {
      console.error("Local booking confirmation failed", error.code, error.message);
      const status = error.code === "P0002" ? 404 : error.code === "P0001" ? 409 : 500;
      return json({ error: error.message }, status);
    }

    const booking = data?.[0];
    if (!booking) return json({ error: "The reservation could not be confirmed." }, 500);

    let emailSent = Boolean(booking.confirmation_email_sent_at);
    if (!emailSent) {
      try {
        await sendConfirmationEmail(booking, accessToken);
        await context.supabaseAdmin.rpc("mark_booking_confirmation_email", {
          p_booking_id: booking.booking_id,
          p_error: null,
        });
        emailSent = true;
      } catch (emailError) {
        const message = emailError instanceof Error ? emailError.message : "Email delivery failed.";
        console.error(message);
        await context.supabaseAdmin.rpc("mark_booking_confirmation_email", {
          p_booking_id: booking.booking_id,
          p_error: message.slice(0, 1000),
        });
        return json({
          error: "The reservation was confirmed, but the confirmation email could not be sent.",
          confirmed: true,
          reservationCode: booking.reservation_code,
        }, 502);
      }
    }

    return json({
      confirmed: true,
      reservationCode: booking.reservation_code,
      emailSent,
      email: booking.guest_email,
    });
  }),
};
