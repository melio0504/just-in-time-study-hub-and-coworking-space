import { withSupabase } from "@supabase/server";

const PAYMONGO_API = "https://api.paymongo.com/v1";
const QR_EXPIRY_SECONDS = 15 * 60;

type PayMongoResource<T> = {
  data: {
    id: string;
    attributes: T;
  };
};

type PaymentIntentAttributes = {
  amount: number;
  currency: string;
  status: string;
  livemode: boolean;
  client_key: string;
  next_action?: { code?: { image_url?: string } } | null;
};

type PaymentMethodAttributes = {
  created_at?: number;
};

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function configuredKeys() {
  const secretKey = Deno.env.get("PAYMONGO_SECRET_KEY")?.trim();
  const publicKey = Deno.env.get("PAYMONGO_PUBLIC_KEY")?.trim();
  const mode = (Deno.env.get("PAYMONGO_MODE") ?? "test").trim().toLowerCase();
  const expectedSecretPrefix = mode === "live" ? "sk_live_" : "sk_test_";
  const expectedPublicPrefix = mode === "live" ? "pk_live_" : "pk_test_";

  if (!secretKey || !publicKey) {
    throw new Error("PayMongo is not configured on the server.");
  }
  if (!["test", "live"].includes(mode)) {
    throw new Error("PAYMONGO_MODE must be either test or live.");
  }
  if (!secretKey.startsWith(expectedSecretPrefix) || !publicKey.startsWith(expectedPublicPrefix)) {
    throw new Error(`The PayMongo keys do not match PAYMONGO_MODE=${mode}.`);
  }

  return { secretKey, publicKey, livemode: mode === "live" };
}

async function paymongoRequest<T>(
  path: string,
  key: string,
  options: { method?: "GET" | "POST"; body?: unknown; idempotencyKey?: string } = {},
) {
  const response = await fetch(`${PAYMONGO_API}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${btoa(`${key}:`)}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = Array.isArray(payload?.errors)
      ? payload.errors
          .map((error: { detail?: string; code?: string }) => error.detail ?? error.code)
          .filter(Boolean)
          .join("; ")
      : `HTTP ${response.status}`;
    throw new Error(`PayMongo request failed: ${detail || `HTTP ${response.status}`}`);
  }
  return payload as T;
}

function qrImage(intent: PayMongoResource<PaymentIntentAttributes>) {
  const image = intent.data.attributes.next_action?.code?.image_url;
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    throw new Error("PayMongo did not return a QR Ph image.");
  }
  return image;
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
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookingId)
    ) {
      return json({ error: "Invalid booking." }, 400);
    }

    try {
      const keys = configuredKeys();
      const userId = context.userClaims!.id;

      const { error: emailSyncError } = await context.supabaseAdmin.rpc(
        "sync_booking_account_email",
        {
          p_booking_id: bookingId,
          p_user_id: userId,
        },
      );
      if (emailSyncError) throw new Error(emailSyncError.message);

      const { data, error } = await context.supabaseAdmin.rpc("prepare_paymongo_payment", {
        p_booking_id: bookingId,
        p_user_id: userId,
      });
      if (error) {
        const status = error.code === "P0002" ? 404 : error.code === "P0001" ? 409 : 500;
        return json({ error: error.message }, status);
      }

      const booking = data?.[0];
      if (!booking) return json({ error: "The payment could not be prepared." }, 500);

      if (booking.provider_payment_intent_id) {
        if (booking.qr_expires_at && new Date(booking.qr_expires_at).getTime() <= Date.now()) {
          return json({ error: "This QR Ph code expired. Please create a new reservation." }, 409);
        }

        const intent = await paymongoRequest<PayMongoResource<PaymentIntentAttributes>>(
          `/payment_intents/${encodeURIComponent(booking.provider_payment_intent_id)}`,
          keys.secretKey,
        );
        return json({
          bookingId,
          reservationCode: booking.reservation_code,
          amountCents: booking.amount_cents,
          qrImage: qrImage(intent),
          expiresAt: booking.qr_expires_at,
          status: intent.data.attributes.status,
        });
      }

      const intent = await paymongoRequest<PayMongoResource<PaymentIntentAttributes>>(
        "/payment_intents",
        keys.secretKey,
        {
          method: "POST",
          idempotencyKey: `booking/${bookingId}/payment-intent`,
          body: {
            data: {
              attributes: {
                amount: booking.amount_cents,
                currency: "PHP",
                payment_method_allowed: ["qrph"],
                description: `Study Hub reservation ${booking.reservation_code}`,
                metadata: {
                  booking_id: bookingId,
                  reservation_code: booking.reservation_code,
                },
              },
            },
          },
        },
      );

      if (
        intent.data.attributes.amount !== booking.amount_cents ||
        intent.data.attributes.currency !== "PHP"
      ) {
        throw new Error("PayMongo returned an unexpected payment amount.");
      }

      const method = await paymongoRequest<PayMongoResource<PaymentMethodAttributes>>(
        "/payment_methods",
        keys.publicKey,
        {
          method: "POST",
          idempotencyKey: `booking/${bookingId}/qrph-method`,
          body: {
            data: {
              attributes: {
                type: "qrph",
                expiry_seconds: QR_EXPIRY_SECONDS,
                billing: {
                  name: booking.guest_name,
                  email: booking.guest_email,
                },
              },
            },
          },
        },
      );

      const attached = await paymongoRequest<PayMongoResource<PaymentIntentAttributes>>(
        `/payment_intents/${encodeURIComponent(intent.data.id)}/attach`,
        keys.publicKey,
        {
          method: "POST",
          idempotencyKey: `booking/${bookingId}/attach-qrph`,
          body: {
            data: {
              attributes: {
                payment_method: method.data.id,
                client_key: intent.data.attributes.client_key,
              },
            },
          },
        },
      );

      const createdAtSeconds =
        Number(method.data.attributes.created_at) || Math.floor(Date.now() / 1000);
      const expiresAt = new Date((createdAtSeconds + QR_EXPIRY_SECONDS) * 1000).toISOString();
      const { error: saveError } = await context.supabaseAdmin.rpc("save_paymongo_qr", {
        p_booking_id: bookingId,
        p_user_id: userId,
        p_payment_intent_id: intent.data.id,
        p_payment_method_id: method.data.id,
        p_provider_status: attached.data.attributes.status,
        p_qr_expires_at: expiresAt,
        p_livemode: keys.livemode,
      });
      if (saveError) throw new Error(saveError.message);

      return json(
        {
          bookingId,
          reservationCode: booking.reservation_code,
          amountCents: booking.amount_cents,
          qrImage: qrImage(attached),
          expiresAt,
          status: attached.data.attributes.status,
        },
        201,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate QR Ph.";
      console.error("PayMongo QR creation failed", message);
      return json({ error: message }, 502);
    }
  }),
};
