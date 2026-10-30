import { describe, expect, it } from "vitest";

import { formatCountdown, getCountdownSeconds } from "./paymentCountdown";

describe("payment countdown", () => {
  it("calculates the remaining whole seconds from the server expiry", () => {
    const now = Date.parse("2026-10-15T12:00:00.750Z");

    expect(getCountdownSeconds("2026-10-15T12:15:00.000Z", now)).toBe(900);
  });

  it("stops at zero after expiration", () => {
    const now = Date.parse("2026-10-15T12:15:01.000Z");

    expect(getCountdownSeconds("2026-10-15T12:15:00.000Z", now)).toBe(0);
    expect(getCountdownSeconds("not-a-date", now)).toBe(0);
  });

  it("formats the countdown as minutes and seconds", () => {
    expect(formatCountdown(900)).toBe("15:00");
    expect(formatCountdown(65)).toBe("01:05");
    expect(formatCountdown(0)).toBe("00:00");
  });
});
