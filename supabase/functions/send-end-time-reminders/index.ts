import { withSupabase } from "@supabase/server";

const encoder = new TextEncoder();

type Reminder = {
  session_id: string;
  booking_id: string;
  reservation_code: string;
  guest_name: string;
  guest_email: string;
  seat_ids: string[];
  scheduled_end_at: string;
  hourly_rate_cents: number;
};

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character]!,
  );
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

async function sha256Bytes(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function hasValidCronSecret(request: Request, expectedSecret: string) {
  const providedSecret = request.headers.get("x-cron-secret") ?? "";
  const [providedHash, expectedHash] = await Promise.all([
    sha256Bytes(providedSecret),
    sha256Bytes(expectedSecret),
  ]);

  let difference = 0;
  for (let index = 0; index < expectedHash.length; index += 1) {
    difference |= providedHash[index] ^ expectedHash[index];
  }
  return difference === 0;
}

async function sendReminderEmail(reminder: Reminder) {
  const minutesRemaining = Math.max(
    0,
    Math.ceil((new Date(reminder.scheduled_end_at).getTime() - Date.now()) / 60_000),
  );
  const hourlyRate = formatPeso(reminder.hourly_rate_cents);
  const reservationCode = escapeHtml(reminder.reservation_code);
  const email = {
    to: reminder.guest_email,
    subject: `${minutesRemaining} minutes remaining — ${reminder.reservation_code}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#2d2520">
        <h1 style="color:#b57b12">Your reservation ends soon</h1>
        <p>Hello ${escapeHtml(reminder.guest_name)},</p>
        <p>Your Just In Time Study Hub reservation has about <strong>${minutesRemaining} minutes remaining</strong>.</p>
        <div style="background:#fff8ed;border:1px solid #eadfce;border-radius:16px;padding:20px">
          <p><strong>Reservation:</strong> ${reservationCode}</p>
          <p><strong>Seats:</strong> ${escapeHtml(reminder.seat_ids.join(", "))}</p>
          <p><strong>Scheduled end:</strong> ${escapeHtml(formatManila(reminder.scheduled_end_at))}</p>
        </div>
        <div style="margin-top:20px;background:#fff4e5;border-left:4px solid #d97706;padding:16px">
          <p style="margin-top:0"><strong>Please scan your QR pass at the kiosk when you leave.</strong></p>
          <p style="margin-bottom:0">There is a 20-minute grace period. At 20 minutes overtime, an additional whole hour is charged at ${escapeHtml(hourlyRate)} per hour for your reserved seat${reminder.seat_ids.length === 1 ? "" : "s"}. Further overtime is rounded up to the next whole hour and must be paid at the front desk.</p>
        </div>
      </div>`,
  };

  const provider = (Deno.env.get("EMAIL_PROVIDER") ?? "mailpit").trim().toLowerCase();
  const fromEmail =
    Deno.env.get("EMAIL_FROM") ??
    Deno.env.get("RESEND_FROM_EMAIL") ??
    "Just In Time Study Hub <bookings@local.test>";

  if (provider === "mailpit") {
    const senderMatch = fromEmail.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
    const sender = senderMatch
      ? { Name: senderMatch[1], Email: senderMatch[2] }
      : { Email: fromEmail.trim() };
    const response = await fetch(
      Deno.env.get("MAILPIT_API_URL") ?? "http://inbucket:8025/api/v1/send",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          From: sender,
          To: [{ Email: email.to }],
          Subject: email.subject,
          HTML: email.html,
          Tags: ["reservation-end-reminder"],
        }),
      },
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `Mailpit rejected the reminder email (${response.status}): ${detail.slice(0, 300)}`,
      );
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
      "Idempotency-Key": `reservation-end-reminder/${reminder.session_id}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email.to],
      subject: email.subject,
      html: email.html,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Resend rejected the reminder email (${response.status}): ${detail.slice(0, 300)}`,
    );
  }
}

export default {
  fetch: withSupabase({ auth: "none" }, async (request, context) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

    const cronSecret = Deno.env.get("END_TIME_REMINDER_CRON_SECRET")?.trim() ?? "";
    if (cronSecret.length < 32) {
      console.error("END_TIME_REMINDER_CRON_SECRET is missing or shorter than 32 characters.");
      return json({ error: "End-time reminders are not configured." }, 503);
    }
    if (!(await hasValidCronSecret(request, cronSecret))) {
      return json({ error: "Invalid scheduler credential." }, 401);
    }

    const { data, error } = await context.supabaseAdmin.rpc("claim_end_time_reminders", {
      p_limit: 50,
    });
    if (error) {
      console.error("Unable to claim end-time reminders:", error.code, error.message);
      return json({ error: "End-time reminders could not be prepared." }, 500);
    }

    let sent = 0;
    let failed = 0;
    for (const row of (data ?? []) as Reminder[]) {
      let deliveryError: string | null = null;
      try {
        await sendReminderEmail(row);
        sent += 1;
      } catch (error) {
        deliveryError = error instanceof Error ? error.message : "Email delivery failed.";
        failed += 1;
        console.error("End-time reminder delivery failed", row.session_id, deliveryError);
      }

      const { error: completionError } = await context.supabaseAdmin.rpc(
        "complete_end_time_reminder",
        { p_session_id: row.session_id, p_error: deliveryError },
      );
      if (completionError) {
        console.error(
          "Unable to complete end-time reminder",
          row.session_id,
          completionError.code,
          completionError.message,
        );
      }
    }

    return json({ claimed: data?.length ?? 0, sent, failed });
  }),
};
