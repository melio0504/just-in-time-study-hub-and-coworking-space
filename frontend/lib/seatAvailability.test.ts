import { describe, expect, it } from "vitest";

import {
  getOperatingDayAvailabilityWindow,
  getReservationAvailabilityWindow,
} from "./seatAvailability";

describe("seat availability windows", () => {
  it("uses the Manila operating day for the virtual tour", () => {
    expect(getOperatingDayAvailabilityWindow("2026-10-13")).toEqual({
      startsAt: "2026-10-13T00:00:00.000Z",
      endsAt: "2026-10-13T21:00:00.000Z",
    });
  });

  it.each([
    ["", ""],
    ["09:00", ""],
  ])(
    "keeps the reservation layout on the operating-day window until the schedule is complete",
    (time, duration) => {
      expect(getReservationAvailabilityWindow("2026-10-13", time, duration)).toEqual(
        getOperatingDayAvailabilityWindow("2026-10-13"),
      );
    },
  );

  it("uses the selected reservation interval once time and duration are complete", () => {
    expect(getReservationAvailabilityWindow("2026-10-13", "23:00", "4")).toEqual({
      startsAt: "2026-10-13T15:00:00.000Z",
      endsAt: "2026-10-13T19:00:00.000Z",
    });
  });
});
