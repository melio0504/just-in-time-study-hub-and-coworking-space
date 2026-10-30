import { describe, expect, it } from "vitest";

import { getManilaDateString, isReservationTimePast } from "./reservationTime";

describe("reservation time", () => {
  it("gets today using the Manila timezone", () => {
    expect(getManilaDateString(new Date("2026-10-15T16:30:00.000Z"))).toBe("2026-10-16");
  });

  it("disables started and earlier time slots on the current Manila date", () => {
    const now = new Date("2026-10-15T12:05:00.000Z"); // 8:05 PM in Manila

    expect(isReservationTimePast("2026-10-15", "19:00", now)).toBe(true);
    expect(isReservationTimePast("2026-10-15", "20:00", now)).toBe(true);
    expect(isReservationTimePast("2026-10-15", "21:00", now)).toBe(false);
  });

  it("treats an option at the exact current time as unavailable", () => {
    const now = new Date("2026-10-15T12:00:00.000Z"); // 8:00 PM in Manila

    expect(isReservationTimePast("2026-10-15", "20:00", now)).toBe(true);
  });

  it("keeps future dates available and rejects earlier dates", () => {
    const now = new Date("2026-10-15T12:05:00.000Z");

    expect(isReservationTimePast("2026-10-16", "00:00", now)).toBe(false);
    expect(isReservationTimePast("2026-10-15", "04:00", now)).toBe(true);
    expect(isReservationTimePast("2026-10-14", "23:00", now)).toBe(true);
  });
});
