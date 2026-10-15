import { withSupabase } from "@supabase/server";

const PAYMONGO_API = "https://api.paymongo.com/v1";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type JsonObject = Record<string, unknown>;

function json(body: JsonObject, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function configuredPayMongo() {
  const mode = (Deno.env.get("PAYMONGO_MODE") ?? "test").trim().toLowerCase();
  const secretKey = Deno.env.get("PAYMONGO_SECRET_KEY")?.trim();
  const simulateRefunds = (Deno.env.get("PAYMONGO_SIMULATE_REFUNDS") ?? "false").trim().toLowerCase() === "true";
  if (mode !== "test" && mode !== "live") throw new Error("PAYMONGO_MODE must be test or live.");
  if (mode === "live" && simulateRefunds) throw new Error("Refund simulation must be disabled in live mode.");
  const expectedPrefix = mode === "live" ? "sk_live_" : "sk_test_";
  if (!secretKey?.startsWith(expectedPrefix)) {
    throw new Error("PayMongo is not configured for the selected mode.");
  }
  return { secretKey, livemode: mode === "live", simulateRefunds };
}

function providerError(payload: unknown, status: number) {
  const errors = object(payload).errors;
  if (!Array.isArray(errors)) return { code: `http_${status}`, message: `PayMongo rejected the refund (HTTP ${status}).` };
  const first = object(errors[0]);
  return {
    code: String(first.code ?? `http_${status}`).slice(0, 120),
    message: String(first.detail ?? "PayMongo could not process the refund.").slice(0, 1000),
  };
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

    const { data, error: prepareError } = await context.supabaseAdmin.rpc(
      "prepare_customer_booking_cancellation",
      { p_booking_id: bookingId, p_user_id: context.userClaims!.id },
    );
    if (prepareError) {
      const status = prepareError.code === "P0002" ? 404 : prepareError.code === "P0001" ? 409 : 500;
      return json({ error: prepareError.message }, status);
    }

    const cancellation = data?.[0];
    if (!cancellation) return json({ error: "The cancellation could not be prepared." }, 500);
    if (!cancellation.requires_refund) {
      return json({ cancelled: true, refunded: false, reservationCode: cancellation.reservation_code });
    }

    if (cancellation.provider_refund_id) {
      if (cancellation.refund_status === "failed") {
        return json({ error: "The refund failed and needs staff assistance." }, 409);
      }
      return json({
        cancelled: true,
        refunded: cancellation.refund_status === "succeeded",
        refundStatus: cancellation.refund_status,
        reservationCode: cancellation.reservation_code,
      });
    }

    let config: ReturnType<typeof configuredPayMongo>;
    try {
      config = configuredPayMongo();
    } catch (configurationError) {
      const message = configurationError instanceof Error ? configurationError.message : "Refunds are not configured.";
      return json({ error: message }, 503);
    }

    if (cancellation.payment_livemode !== config.livemode) {
      return json({
        error: "The payment and refund environments do not match. Check PAYMONGO_MODE before retrying.",
      }, 409);
    }

    // PayMongo only supports provider refunds for live transactions. Local and
    // hosted test environments can explicitly simulate the provider success so
    // the complete cancellation lifecycle remains testable without moving money.
    if (!config.livemode) {
      if (!config.simulateRefunds) {
        return json({
          error: "PayMongo does not refund test transactions. Set PAYMONGO_SIMULATE_REFUNDS=true in the Edge Function test environment to simulate a successful refund.",
        }, 503);
      }

      const providerRefundId = `ref_test_sim_${String(cancellation.refund_id).replaceAll("-", "")}`;
      const simulatedPayload = {
        data: {
          id: providerRefundId,
          type: "refund",
          attributes: {
            amount: cancellation.amount_cents,
            payment_id: cancellation.provider_payment_id,
            status: "succeeded",
            livemode: false,
            simulated: true,
          },
        },
      };
      const { error: finalizeError } = await context.supabaseAdmin.rpc("finalize_customer_booking_refund", {
        p_refund_id: cancellation.refund_id,
        p_provider_refund_id: providerRefundId,
        p_status: "succeeded",
        p_failure_code: null,
        p_failure_message: null,
        p_provider_payload: simulatedPayload,
      });
      if (finalizeError) {
        console.error("Simulated refund finalization failed", finalizeError.message);
        return json({ error: "The test refund could not be finalized." }, 500);
      }
      return json({
        cancelled: true,
        refunded: true,
        refundStatus: "succeeded",
        reservationCode: cancellation.reservation_code,
        simulated: true,
      });
    }

    let response: Response;
    let payload: unknown;
    try {
      response = await fetch(`${PAYMONGO_API}/refunds`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${btoa(`${config.secretKey}:`)}`,
          "Content-Type": "application/json",
          "Idempotency-Key": cancellation.idempotency_key,
        },
        body: JSON.stringify({
          data: {
            attributes: {
              amount: cancellation.amount_cents,
              payment_id: cancellation.provider_payment_id,
              reason: "others",
              notes: `Customer cancelled reservation ${cancellation.reservation_code}`,
              metadata: {
                booking_id: bookingId,
                refund_id: cancellation.refund_id,
              },
            },
          },
        }),
      });
      payload = await response.json().catch(() => null);
    } catch (networkError) {
      const message = networkError instanceof Error ? networkError.message : "PayMongo could not be reached.";
      await context.supabaseAdmin.rpc("finalize_customer_booking_refund", {
        p_refund_id: cancellation.refund_id,
        p_provider_refund_id: null,
        p_status: "failed",
        p_failure_code: "network_error",
        p_failure_message: message,
        p_provider_payload: {},
      });
      return json({ error: "The refund service could not be reached. Your reservation was not cancelled; please try again." }, 502);
    }

    if (!response.ok) {
      const providerFailure = providerError(payload, response.status);
      console.error("PayMongo refund request failed", {
        status: response.status,
        code: providerFailure.code,
        message: providerFailure.message,
      });
      if (response.status !== 409) {
        await context.supabaseAdmin.rpc("finalize_customer_booking_refund", {
          p_refund_id: cancellation.refund_id,
          p_provider_refund_id: null,
          p_status: "failed",
          p_failure_code: providerFailure.code,
          p_failure_message: providerFailure.message,
          p_provider_payload: object(payload),
        });
      }
      return json({
        error: response.status === 409
          ? "The refund is already being processed. Please wait a moment and refresh."
          : providerFailure.message,
      }, response.status === 409 ? 409 : 502);
    }

    const refund = object(object(payload).data);
    const attributes = object(refund.attributes);
    const providerRefundId = String(refund.id ?? "");
    const refundStatus = String(attributes.status ?? "");
    const validResponse = /^ref_[A-Za-z0-9_-]+$/.test(providerRefundId)
      && String(attributes.payment_id ?? "") === cancellation.provider_payment_id
      && Number(attributes.amount) === Number(cancellation.amount_cents)
      && Boolean(attributes.livemode) === config.livemode
      && ["processing", "pending", "succeeded", "failed"].includes(refundStatus);

    if (!validResponse) {
      return json({ error: "PayMongo returned an unexpected refund response. Please contact the front desk." }, 502);
    }

    const { error: finalizeError } = await context.supabaseAdmin.rpc("finalize_customer_booking_refund", {
      p_refund_id: cancellation.refund_id,
      p_provider_refund_id: providerRefundId,
      p_status: refundStatus,
      p_failure_code: refundStatus === "failed" ? "provider_refund_failed" : null,
      p_failure_message: refundStatus === "failed" ? "PayMongo could not complete the refund." : null,
      p_provider_payload: object(payload),
    });
    if (finalizeError) {
      console.error("Refund accepted but local finalization failed", finalizeError.message);
      return json({ error: "The refund was accepted but needs staff reconciliation." }, 500);
    }
    if (refundStatus === "failed") {
      return json({ error: "PayMongo could not complete the refund. Your reservation was not cancelled." }, 502);
    }

    return json({
      cancelled: true,
      refunded: refundStatus === "succeeded",
      refundStatus,
      reservationCode: cancellation.reservation_code,
    });
  }),
};
