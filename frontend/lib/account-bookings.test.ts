import { describe, expect, it } from "vitest";
import { belongsInAccountHistory } from "./account-bookings";

describe("belongsInAccountHistory", () => {
  it("hides abandoned and declined payment attempts", () => {
    expect(belongsInAccountHistory({ status: "declined", payment_status: "failed" })).toBe(false);
  });

  it("hides legacy unpaid reservations recorded as cancelled", () => {
    expect(belongsInAccountHistory({ status: "cancelled", payment_status: "pending" })).toBe(false);
  });

  it.each(["paid", "processing", "refunded"] as const)(
    "keeps a %s cancellation in reservation history",
    (paymentStatus) => {
      expect(belongsInAccountHistory({ status: "cancelled", payment_status: paymentStatus })).toBe(
        true,
      );
    },
  );

  it("keeps active and completed reservations", () => {
    expect(belongsInAccountHistory({ status: "confirmed", payment_status: "paid" })).toBe(true);
    expect(belongsInAccountHistory({ status: "completed", payment_status: "paid" })).toBe(true);
  });
});
