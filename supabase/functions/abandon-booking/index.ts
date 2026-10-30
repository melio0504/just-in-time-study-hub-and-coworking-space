import { withSupabase } from "@supabase/server";

const PAYMONGO_API = "https://api.paymongo.com/v1";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type JsonObject = Record<string, unknown>;

function json(body: JsonObject, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function configuredPayMongo() {
  const mode = (Deno.env.get("PAYMONGO_MODE") ?? "test").trim().toLowerCase();
  const secretKey = Deno.env.get("PAYMONGO_SECRET_KEY")?.trim();
  if (mode !== "test" && mode !== "live") throw new Error("PAYMONGO_MODE must be test or live.");
  const expectedPrefix = mode === "live" ? "sk_live_" : "sk_test_";
  if (!secretKey?.startsWith(expectedPrefix)) {
    throw new Error("PayMongo is not configured for the selected mode.");
  }
  return { secretKey, livemode: mode === "live" };
}

async function payMongoIntent(path: string, secretKey: string, method: "GET" | "POST") {
  const response = await fetch(`${PAYMONGO_API}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${btoa(`${secretKey}:`)}`,
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
  });
  const payload = await response.json().catch(() => null);
  return { response, payload };
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

    const userId = context.userClaims!.id;
    const { data, error: lookupError } = await context.supabaseAdmin.rpc(
      "prepare_booking_abandonment",
      { p_booking_id: bookingId, p_user_id: userId },
    );

    if (lookupError) {
      console.error("Abandonment lookup failed", lookupError.message);
      const status =
        lookupError.code === "P0002" ? 404 : lookupError.code === "P0001" ? 409 : 500;
      return json(
        {
          error:
            status === 500 ? "The reservation could not be checked." : lookupError.message,
        },
        status,
      );
    }
    const booking = data?.[0];
    if (!booking) return json({ error: "Reservation not found." }, 404);

    if (
      !["pending", "declined"].includes(booking.booking_status) ||
      booking.booking_payment_status === "paid" ||
      booking.payment_status === "paid" ||
      booking.payment_status === "refunded"
    ) {
      return json({ error: "This reservation can no longer be abandoned." }, 409);
    }

    const intentId = booking.provider_payment_intent_id;
    if (intentId) {
      let config: ReturnType<typeof configuredPayMongo>;
      try {
        config = configuredPayMongo();
      } catch (configurationError) {
        const message =
          configurationError instanceof Error
            ? configurationError.message
            : "PayMongo is not configured.";
        return json({ error: message }, 503);
      }

      if (booking.payment_livemode !== config.livemode) {
        return json({ error: "The payment environment does not match PAYMONGO_MODE." }, 409);
      }

      try {
        const cancellation = await payMongoIntent(
          `/payment_intents/${encodeURIComponent(intentId)}/cancel`,
          config.secretKey,
          "POST",
        );
        const cancellationIntent = object(object(cancellation.payload).data);
        const cancellationStatus = String(object(cancellationIntent.attributes).status ?? "");

        if (!cancellation.response.ok || cancellationStatus !== "cancelled") {
          const current = await payMongoIntent(
            `/payment_intents/${encodeURIComponent(intentId)}`,
            config.secretKey,
            "GET",
          );
          const currentIntent = object(object(current.payload).data);
          const currentStatus = String(object(currentIntent.attributes).status ?? "");
          if (current.response.ok && currentStatus === "succeeded") {
            return json(
              { error: "Payment was already received. Your reservation is being confirmed." },
              409,
            );
          }
          if (!current.response.ok || currentStatus !== "cancelled") {
            return json(
              { error: "The QR Ph payment could not be stopped. Please try again." },
              502,
            );
          }
        }
      } catch (networkError) {
        console.error(
          "PayMongo abandonment failed",
          networkError instanceof Error ? networkError.message : networkError,
        );
        return json({ error: "PayMongo could not be reached. Please try again." }, 502);
      }
    }

    const { data: reservationCode, error: abandonError } = await context.supabaseAdmin.rpc(
      "abandon_unpaid_booking",
      { p_booking_id: bookingId, p_user_id: userId },
    );
    if (abandonError) {
      const status =
        abandonError.code === "P0002" ? 404 : abandonError.code === "P0001" ? 409 : 500;
      return json({ error: abandonError.message }, status);
    }

    return json({ abandoned: true, reservationCode });
  }),
};
