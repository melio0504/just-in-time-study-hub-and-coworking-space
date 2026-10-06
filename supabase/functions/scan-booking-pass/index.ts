import { withSupabase } from "@supabase/server";

const encoder = new TextEncoder();

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default {
  fetch: withSupabase({ auth: "none" }, async (request, context) => {
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
    // The QR token is the kiosk credential. Keep database writes behind this
    // server-only client so anonymous browsers never receive elevated keys.
    const { data, error } = await context.supabaseAdmin.rpc("process_kiosk_scan", {
      p_token_hash: await sha256(token),
    });

    if (error) {
      const status = error.code === "42501" ? 403 : 409;
      return json({ error: error.message }, status);
    }

    return json({ result: data?.[0] ?? null });
  }),
};
