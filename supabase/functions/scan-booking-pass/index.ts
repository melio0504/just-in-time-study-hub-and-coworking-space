import { withSupabase } from "@supabase/server";

const encoder = new TextEncoder();
const DISPLAY_TIME_ZONE = "Asia/Manila";

const bookingDateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: DISPLAY_TIME_ZONE,
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function sha256Bytes(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function hasValidKioskToken(request: Request, expectedToken: string) {
  const providedToken = request.headers.get("x-kiosk-token") ?? "";
  const [providedHash, expectedHash] = await Promise.all([
    sha256Bytes(providedToken),
    sha256Bytes(expectedToken),
  ]);

  let difference = 0;
  for (let index = 0; index < expectedHash.length; index += 1) {
    difference |= providedHash[index] ^ expectedHash[index];
  }
  return difference === 0;
}

async function sha256Hex(value: string) {
  const digest = await sha256Bytes(value);
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function formatBookingDateTime(value: string | Date) {
  return bookingDateTimeFormatter.format(new Date(value));
}

function parseCheckInWindow(details: string | null | undefined) {
  if (!details) return null;

  try {
    const value = JSON.parse(details) as Record<string, unknown>;
    if (
      value.code !== "check_in_not_open" ||
      typeof value.checkInOpensAt !== "string" ||
      typeof value.scheduledStart !== "string" ||
      typeof value.scheduledEnd !== "string"
    ) {
      return null;
    }

    return {
      checkInOpensAt: value.checkInOpensAt,
      scheduledStart: value.scheduledStart,
      scheduledEnd: value.scheduledEnd,
    };
  } catch {
    return null;
  }
}

export default {
  fetch: withSupabase({ auth: "none" }, async (request, context) => {
    const kioskToken = Deno.env.get("KIOSK_ACCESS_TOKEN")?.trim() ?? "";
    if (kioskToken.length < 32) {
      console.error("KIOSK_ACCESS_TOKEN is missing or shorter than 32 characters.");
      return json({ error: "The kiosk service is not configured." }, 503);
    }
    if (!(await hasValidKioskToken(request, kioskToken))) {
      return json({ error: "Invalid kiosk credential." }, 401);
    }

    if (request.method === "GET") {
      const [sessionsResult, activityResult] = await Promise.all([
        context.supabaseAdmin.rpc("get_kiosk_active_sessions"),
        context.supabaseAdmin.rpc("get_kiosk_recent_activity"),
      ]);

      if (sessionsResult.error || activityResult.error) {
        const error = sessionsResult.error ?? activityResult.error;
        console.error("Unable to load kiosk state:", error?.code, error?.message);
        return json({ error: "The kiosk state could not be loaded." }, 500);
      }

      const sessions = (sessionsResult.data ?? []).map((row) => ({
        bookingId: row.booking_id,
        guestName: row.guest_name,
        seats: row.seats,
        checkedInAt: row.checked_in_at,
        scheduledEnd: row.scheduled_end,
      }));
      const activity = (activityResult.data ?? []).map((row) => ({
        id: row.activity_id,
        type: row.activity_type,
        bookingId: row.booking_id,
        guestName: row.guest_name,
        seats: row.seats,
        timestamp: row.occurred_at,
      }));
      return json({ sessions, activity });
    }

    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

    let body: { code?: unknown };
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid request body." }, 400);
    }

    const rawCode = typeof body.code === "string" ? body.code.trim() : "";
    if (!rawCode.startsWith("JITPASS:") || rawCode.length > 512) {
      return json({ error: "Invalid QR pass." }, 400);
    }

    const token = rawCode.slice("JITPASS:".length);
    const tokenHash = await sha256Hex(token);
    const { data, error } = await context.supabaseAdmin.rpc("process_kiosk_scan", {
      p_token_hash: tokenHash,
    });

    if (error) {
      const status = error.code === "42501" ? 403 : 409;
      if (error.message === "This reservation is not ready for check-in yet") {
        const checkInWindow = parseCheckInWindow(error.details);
        if (checkInWindow) {
          const earlyMinutes = Math.round(
            (new Date(checkInWindow.scheduledStart).getTime() -
              new Date(checkInWindow.checkInOpensAt).getTime()) /
              60_000,
          );
          const message =
            `Your reservation starts on ${formatBookingDateTime(checkInWindow.scheduledStart)}. ` +
            `Check-in opens on ${formatBookingDateTime(checkInWindow.checkInOpensAt)} ` +
            `(${earlyMinutes} minutes before) and remains available until ` +
            `${formatBookingDateTime(checkInWindow.scheduledEnd)}.`;

          return json(
            {
              error: message,
              code: "check_in_not_open",
              ...checkInWindow,
            },
            status,
          );
        }
      }

      return json({ error: error.message }, status);
    }

    return json({ result: data?.[0] ?? null });
  }),
};
