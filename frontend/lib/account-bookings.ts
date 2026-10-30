import type { Tables } from "./supabase/database.types";

type BookingLifecycle = Pick<Tables<"bookings">, "status" | "payment_status">;

const cancellationPaymentStatuses = new Set(["paid", "processing", "refunded"]);

export function belongsInAccountHistory(booking: BookingLifecycle) {
  if (booking.status === "declined") return false;
  if (booking.status === "cancelled") {
    return cancellationPaymentStatuses.has(booking.payment_status);
  }
  return true;
}
