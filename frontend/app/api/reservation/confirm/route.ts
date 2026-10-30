import { NextResponse } from "next/server";

import { getSupabaseConfig } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { token?: unknown; action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const action = body.action === "preview" || body.action === "confirm" ? body.action : "";
  if (!/^[A-Za-z0-9_-]{40,128}$/.test(token) || !action) {
    return NextResponse.json({ error: "Invalid payment request." }, { status: 400 });
  }

  const { supabaseUrl, supabasePublishableKey } = getSupabaseConfig();
  const internalUrl = process.env.SUPABASE_INTERNAL_URL?.trim() || supabaseUrl;

  try {
    const response = await fetch(`${internalUrl}/functions/v1/confirm-booking`, {
      method: "POST",
      headers: {
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${supabasePublishableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token, action }),
      cache: "no-store",
      signal: AbortSignal.timeout(action === "preview" ? 15_000 : 30_000),
    });
    const payload = await response.json().catch(() => ({
      error: "The payment service returned an invalid response.",
    }));

    return NextResponse.json(payload, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Reservation payment service request failed", error);
    return NextResponse.json(
      {
        error:
          "The local payment service is unavailable. Ask staff to check the Supabase Functions service.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
