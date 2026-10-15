import QRCode from "npm:qrcode@1.5.4";

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

function formatPeso(cents: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(cents / 100);
}

function accountUrl() {
  const configured = Deno.env.get("PUBLIC_SITE_URL")?.trim();
  if (!configured) return "";
  try {
    const url = new URL("/account", configured);
    return url.protocol === "https:" || (url.protocol === "http:" && ['localhost', '127.0.0.1'].includes(url.hostname))
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

export async function sendBookingConfirmationEmail(
  booking: Record<string, unknown>,
  accessToken: string,
  options: { resend?: boolean; idempotencyKey?: string } = {},
) {
  const qrDataUrl = await QRCode.toDataURL(`JITPASS:${accessToken}`, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 480,
  });
  const qrBase64 = qrDataUrl.split(",", 2)[1];
  const seats = (booking.seat_ids as string[]).join(", ");
  const reservationCode = String(booking.reservation_code);
  const reservationUrl = accountUrl();
  const email = {
    to: String(booking.guest_email),
    subject: options.resend
      ? `Your QR access pass — ${reservationCode}`
      : `Payment received — ${reservationCode}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#2d2520">
        <h1 style="color:#b57b12">Reservation confirmed</h1>
        <p>Hello ${escapeHtml(String(booking.guest_name))},</p>
        <p>${options.resend
          ? "Here is the replacement QR pass you requested for your Just In Time Study Hub reservation."
          : "We received your QR PH payment and confirmed your Just In Time Study Hub reservation."}</p>
        <div style="background:#fff8ed;border:1px solid #eadfce;border-radius:16px;padding:20px">
          <p><strong>Reservation:</strong> ${escapeHtml(reservationCode)}</p>
          <p><strong>Seats:</strong> ${escapeHtml(seats)}</p>
          <p><strong>Starts:</strong> ${escapeHtml(formatManila(String(booking.starts_at)))}</p>
          <p><strong>Ends:</strong> ${escapeHtml(formatManila(String(booking.ends_at)))}</p>
          <p><strong>Total paid:</strong> ${escapeHtml(formatPeso(Number(booking.subtotal_cents)))}</p>
          <p><strong>Payment method:</strong> QR PH</p>
        </div>
        ${reservationUrl ? `<p style="margin:24px 0"><a href="${escapeHtml(reservationUrl)}" style="background:#b57b12;color:white;padding:12px 18px;border-radius:999px;text-decoration:none">View your reservation</a></p>` : ""}
        <h2>Your kiosk access pass</h2>
        <p>Show this QR code at the facility kiosk. Scan once to check in and scan it again to check out.</p>
        <p style="text-align:center"><img src="cid:booking-access-qr" width="280" height="280" alt="Booking access QR code"></p>
        <p style="font-size:13px;color:#6b5e52">Do not share this QR code. It grants access to your reservation.</p>
      </div>`,
    attachment: {
      filename: `reservation-${reservationCode}.png`,
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
        Tags: ["booking-confirmation", "paymongo-qrph"],
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
      "Idempotency-Key": options.idempotencyKey ?? `booking-confirmation/${booking.booking_id}`,
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
