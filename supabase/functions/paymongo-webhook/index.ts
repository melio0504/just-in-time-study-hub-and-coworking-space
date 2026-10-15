import { withSupabase } from "@supabase/server";
import { sendBookingConfirmationEmail } from "../_shared/booking-confirmation-email.ts";

const PAYMONGO_API = "https://api.paymongo.com/v1";
const encoder = new TextEncoder();

type JsonObject = Record<string, unknown>;

function json(body: JsonObject, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
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

function constantTimeHexEqual(left: string, right: string) {
  if (!/^[0-9a-f]{64}$/i.test(left) || !/^[0-9a-f]{64}$/i.test(right)) return false;
  const leftBytes = new Uint8Array(left.match(/../g)!.map((part) => Number.parseInt(part, 16)));
  const rightBytes = new Uint8Array(right.match(/../g)!.map((part) => Number.parseInt(part, 16)));
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

async function verifySignature(rawBody: string, header: string, secret: string, mode: "test" | "live") {
  const parts = Object.fromEntries(header.split(",").map((part) => {
    const [name, ...value] = part.trim().split("=");
    return [name, value.join("=")];
  }));
  const timestamp = Number(parts.t);
  const received = mode === "live" ? parts.li : parts.te;
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300 || !received) return false;
  const expected = hex(await hmac(`${parts.t}.${rawBody}`, secret));
  return constantTimeHexEqual(received, expected);
}

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function configuredPayMongo() {
  const modeValue = (Deno.env.get("PAYMONGO_MODE") ?? "test").trim().toLowerCase();
  if (modeValue !== "test" && modeValue !== "live") throw new Error("PAYMONGO_MODE must be test or live.");
  const mode = modeValue as "test" | "live";
  const secretKey = Deno.env.get("PAYMONGO_SECRET_KEY")?.trim();
  const webhookSecret = Deno.env.get("PAYMONGO_WEBHOOK_SECRET")?.trim();
  const expectedPrefix = mode === "live" ? "sk_live_" : "sk_test_";
  if (!secretKey?.startsWith(expectedPrefix) || !webhookSecret) {
    throw new Error("PayMongo webhook secrets are not configured for the selected mode.");
  }
  return { mode, secretKey, webhookSecret, livemode: mode === "live" };
}

async function retrievePaymentIntent(intentId: string, secretKey: string) {
  const response = await fetch(`${PAYMONGO_API}/payment_intents/${encodeURIComponent(intentId)}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${btoa(`${secretKey}:`)}`,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Could not verify the PayMongo Payment Intent (${response.status}).`);
  return object(payload?.data);
}

async function retrieveRefund(refundId: string, secretKey: string) {
  const response = await fetch(`${PAYMONGO_API}/refunds/${encodeURIComponent(refundId)}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${btoa(`${secretKey}:`)}`,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Could not verify the PayMongo refund (${response.status}).`);
  return object(payload?.data);
}

export default {
  fetch: withSupabase({ auth: "none" }, async (request, context) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

    let config: ReturnType<typeof configuredPayMongo>;
    try {
      config = configuredPayMongo();
    } catch (error) {
      console.error(error);
      return json({ error: "Webhook is not configured." }, 503);
    }

    const rawBody = await request.text();
    if (rawBody.length > 1_000_000) return json({ error: "Payload too large." }, 413);
    const signature = request.headers.get("paymongo-signature") ?? "";
    if (!await verifySignature(rawBody, signature, config.webhookSecret, config.mode)) {
      return json({ error: "Invalid webhook signature." }, 401);
    }

    let event: JsonObject;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return json({ error: "Invalid JSON." }, 400);
    }

    const eventData = object(event.data);
    const eventAttributes = object(eventData.attributes);
    const resource = object(eventAttributes.data);
    const resourceAttributes = object(resource.attributes);
    const originalEventType = String(eventAttributes.type ?? "");
    const refundEventTypes = [
      "payment.refunded",
      "payment.refund.updated",
      "refund.succeeded",
      "refund.failed",
      "refund.updated",
    ];
    if (!["payment.paid", "payment.failed", "qrph.expired", ...refundEventTypes].includes(originalEventType)) {
      return json({ received: true, ignored: true });
    }

    const eventId = String(eventData.id ?? "");
    if (!/^evt_[A-Za-z0-9_-]+$/.test(eventId)) {
      return json({ error: "Webhook does not identify a PayMongo event." }, 422);
    }

    if (refundEventTypes.includes(originalEventType)) {
      try {
        const embeddedRefunds = Array.isArray(resourceAttributes.refunds)
          ? resourceAttributes.refunds.map(object)
          : [];
        const refundCandidate = resource.type === "refund"
          ? resource
          : embeddedRefunds.at(-1) ?? {};
        const refundId = String(refundCandidate.id ?? "");
        if (!/^ref_[A-Za-z0-9_-]+$/.test(refundId)) {
          throw new Error("Refund webhook does not identify a refund resource.");
        }

        const refund = await retrieveRefund(refundId, config.secretKey);
        const refundAttributes = object(refund.attributes);
        const refundMetadata = object(refundAttributes.metadata);
        const refundStatus = String(refundAttributes.status ?? "");
        const internalRefundId = String(refundMetadata.refund_id ?? "");
        if (Boolean(refundAttributes.livemode) !== config.livemode) {
          throw new Error("PayMongo refund environment mismatch.");
        }
        if (!["processing", "pending", "succeeded", "failed"].includes(refundStatus)) {
          throw new Error("PayMongo returned an unsupported refund status.");
        }

        const { error } = await context.supabaseAdmin.rpc("process_paymongo_refund_event", {
          p_event_id: eventId,
          p_event_type: originalEventType,
          p_refund_id: refundId,
          p_status: refundStatus,
          p_livemode: config.livemode,
          p_payload: event,
          p_internal_refund_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(internalRefundId)
            ? internalRefundId
            : null,
        });
        if (error) throw new Error(error.message);
        return json({ received: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Refund webhook processing failed.";
        console.error("PayMongo refund webhook failed", message);
        return json({ error: message }, 500);
      }
    }

    const intentId = String(
      eventAttributes.payment_intent_id ??
      resourceAttributes.payment_intent_id ??
      (resource.type === "payment_intent" ? resource.id : ""),
    );
    if (!/^pi_[A-Za-z0-9]+$/.test(intentId)) {
      return json({ error: "Webhook does not identify a Payment Intent." }, 422);
    }

    try {
      const intent = await retrievePaymentIntent(intentId, config.secretKey);
      const intentAttributes = object(intent.attributes);
      const metadata = object(intentAttributes.metadata);
      const bookingId = String(metadata.booking_id ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(bookingId)) throw new Error("Payment Intent is missing booking metadata.");
      if (Boolean(intentAttributes.livemode) !== config.livemode) throw new Error("PayMongo environment mismatch.");

      const payments = Array.isArray(intentAttributes.payments) ? intentAttributes.payments.map(object) : [];
      const paidPayment = payments.find((payment) => object(payment.attributes).status === "paid");
      const paymentAttributes = object(paidPayment?.attributes);
      const effectiveEventType = intentAttributes.status === "succeeded" && paidPayment
        ? "payment.paid"
        : originalEventType;

      if (effectiveEventType === "payment.paid" && (!paidPayment || intentAttributes.status !== "succeeded")) {
        throw new Error("PayMongo has not marked this Payment Intent as succeeded.");
      }

      const accessSecret = Deno.env.get("QR_ACCESS_TOKEN_SECRET");
      if (!accessSecret || accessSecret.length < 32) throw new Error("QR access passes are not configured.");
      const accessToken = base64Url(await hmac(`booking:${bookingId}:access-pass:v1`, accessSecret));
      const paidAtSeconds = Number(paymentAttributes.paid_at);

      const { data, error } = await context.supabaseAdmin.rpc("process_paymongo_event", {
        p_event_id: eventId,
        p_event_type: effectiveEventType,
        p_livemode: config.livemode,
        p_payment_intent_id: intentId,
        p_payment_id: effectiveEventType === "payment.paid" ? String(paidPayment?.id ?? "") : null,
        p_amount_cents: effectiveEventType === "payment.paid" ? Number(paymentAttributes.amount) : null,
        p_currency: effectiveEventType === "payment.paid" ? String(paymentAttributes.currency ?? "") : null,
        p_paid_at: effectiveEventType === "payment.paid" && Number.isFinite(paidAtSeconds)
          ? new Date(paidAtSeconds * 1000).toISOString()
          : null,
        p_payload: event,
        p_access_token_hash: await sha256(accessToken),
      });
      if (error) throw new Error(error.message);

      const booking = data?.[0];
      if (!booking) throw new Error("The webhook did not resolve a booking.");
      if (booking.requires_review) {
        console.error(`Manual payment reconciliation required for booking ${booking.booking_id}.`);
        return json({ received: true, requiresReview: true });
      }

      if (effectiveEventType === "payment.paid" && !booking.confirmation_email_sent_at) {
        try {
          await sendBookingConfirmationEmail(booking, accessToken);
          const { error: emailMarkError } = await context.supabaseAdmin.rpc("mark_booking_confirmation_email", {
            p_booking_id: booking.booking_id,
            p_error: null,
          });
          if (emailMarkError) throw new Error(emailMarkError.message);
        } catch (emailError) {
          const message = emailError instanceof Error ? emailError.message : "Email delivery failed.";
          console.error("Booking confirmation email failed", message);
          await context.supabaseAdmin.rpc("mark_booking_confirmation_email", {
            p_booking_id: booking.booking_id,
            p_error: message.slice(0, 1000),
          });
          // A non-2xx response asks PayMongo to retry the signed event. The
          // database finalization and Resend request are both idempotent.
          return json({ error: "Payment was confirmed, but email delivery will be retried." }, 500);
        }
      }

      return json({ received: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Webhook processing failed.";
      console.error("PayMongo webhook failed", message);
      return json({ error: message }, 500);
    }
  }),
};
