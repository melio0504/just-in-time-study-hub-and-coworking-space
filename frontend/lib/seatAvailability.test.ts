import { describe, expect, it } from "vitest";

import {
  formatReservedSeatWindow,
  getOperatingDayAvailabilityWindow,
  getReservationAvailabilityWindow,
  getSeatSelectionAvailabilityWindow,
  groupReservedSeatWindows,
  isReservationWindowFullyReserved,
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

  it("uses the minimum duration as soon as a reservation time is selected", () => {
    expect(getSeatSelectionAvailabilityWindow("2026-11-11", "08:00", "", 1)).toEqual({
      startsAt: "2026-11-11T00:00:00.000Z",
      endsAt: "2026-11-11T01:00:00.000Z",
    });
  });

  it("keeps the whole operating day before a reservation time is selected", () => {
    expect(getSeatSelectionAvailabilityWindow("2026-11-11", "", "", 1)).toEqual(
      getOperatingDayAvailabilityWindow("2026-11-11"),
    );
  });

  it("groups reservation windows by seat code", () => {
    expect(
      groupReservedSeatWindows([
        {
          seat_code: "HC05",
          starts_at: "2026-11-11T01:00:00.000Z",
          ends_at: "2026-11-11T04:00:00.000Z",
        },
        {
          seat_code: "HC05",
          starts_at: "2026-11-11T05:00:00.000Z",
          ends_at: "2026-11-11T08:00:00.000Z",
        },
      ]),
    ).toEqual({
      HC05: [
        {
          startsAt: "2026-11-11T01:00:00.000Z",
          endsAt: "2026-11-11T04:00:00.000Z",
        },
        {
          startsAt: "2026-11-11T05:00:00.000Z",
          endsAt: "2026-11-11T08:00:00.000Z",
        },
      ],
    });
  });

  it("formats reservation windows in Manila time", () => {
    expect(
      formatReservedSeatWindow({
        startsAt: "2026-11-11T01:00:00.000Z",
        endsAt: "2026-11-11T04:00:00.000Z",
      }),
    ).toBe("9:00 AM – 12:00 PM");
  });

  it("labels reservation windows that end the next day", () => {
    expect(
      formatReservedSeatWindow({
        startsAt: "2026-11-11T13:00:00.000Z",
        endsAt: "2026-11-11T17:00:00.000Z",
      }),
    ).toBe("9:00 PM – 1:00 AM (next day)");
  });

  it("detects a time window only when every seat is reserved", () => {
    const windowsBySeat = {
      SO01: [{ startsAt: "2026-11-11T01:00:00.000Z", endsAt: "2026-11-11T04:00:00.000Z" }],
      SO02: [{ startsAt: "2026-11-11T02:00:00.000Z", endsAt: "2026-11-11T05:00:00.000Z" }],
    };

    expect(
      isReservationWindowFullyReserved(windowsBySeat, ["SO01", "SO02"], {
        startsAt: "2026-11-11T02:00:00.000Z",
        endsAt: "2026-11-11T03:00:00.000Z",
      }),
    ).toBe(true);
    expect(
      isReservationWindowFullyReserved(windowsBySeat, ["SO01", "SO02", "SO03"], {
        startsAt: "2026-11-11T02:00:00.000Z",
        endsAt: "2026-11-11T03:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("detects a reservation conflict for a specific selected seat", () => {
    expect(
      isReservationWindowFullyReserved(
        {
          SO04: [{ startsAt: "2026-11-11T13:00:00.000Z", endsAt: "2026-11-11T17:00:00.000Z" }],
        },
        ["SO04"],
        {
          startsAt: "2026-11-11T13:00:00.000Z",
          endsAt: "2026-11-11T14:00:00.000Z",
        },
      ),
    ).toBe(true);
  });

  it("treats reservations ending at the requested start as non-overlapping", () => {
    expect(
      isReservationWindowFullyReserved(
        {
          SO01: [{ startsAt: "2026-11-11T01:00:00.000Z", endsAt: "2026-11-11T02:00:00.000Z" }],
        },
        ["SO01"],
        {
          startsAt: "2026-11-11T02:00:00.000Z",
          endsAt: "2026-11-11T03:00:00.000Z",
        },
      ),
    ).toBe(false);
  });
});
