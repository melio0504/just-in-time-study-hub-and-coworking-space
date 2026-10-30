import { describe, expect, it } from "vitest";

import {
  getOperatingDayAvailabilityWindow,
  getReservationAvailabilityWindow,
} from "./seatAvailability";

describe("admin seat availability windows", () => {
  it("uses the whole Manila operating day when no time is selected", () => {
    expect(getReservationAvailabilityWindow("2026-10-15", "", "")).toEqual(
      getOperatingDayAvailabilityWindow("2026-10-15"),
    );
  });

  it("uses the same selected interval as the customer reservation page", () => {
    expect(getReservationAvailabilityWindow("2026-10-15", "13:00", "4")).toEqual({
      startsAt: "2026-10-15T05:00:00.000Z",
      endsAt: "2026-10-15T09:00:00.000Z",
    });
  });
});
