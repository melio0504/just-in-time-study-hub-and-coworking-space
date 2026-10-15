import { withSupabase } from "@supabase/server";

const encoder = new TextEncoder();

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
      const { data, error } = await context.supabaseAdmin.rpc("get_kiosk_active_sessions");

      if (error) {
        console.error("Unable to load kiosk sessions:", error.code, error.message);
        return json({ error: "Active sessions could not be loaded." }, 500);
      }

      const sessions = (data ?? []).map((row) => ({
        bookingId: row.booking_id,
        guestName: row.guest_name,
        seats: row.seats,
        checkedInAt: row.checked_in_at,
        scheduledEnd: row.scheduled_end,
      }));
      return json({ sessions });
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
    const { data, error } = await context.supabaseAdmin.rpc("process_kiosk_scan", {
      p_token_hash: await sha256Hex(token),
    });

    if (error) {
      const status = error.code === "42501" ? 403 : 409;
      return json({ error: error.message }, status);
    }

    return json({ result: data?.[0] ?? null });
  }),
};
