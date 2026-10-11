import { describe, expect, it } from "vitest";

import {
  TOTAL_SEATS,
  allSeatIds,
  getOccupancyRateForDate,
  getReservedSeatsForDate,
} from "./seats";

describe("seat catalogue", () => {
  it("contains 50 unique, well-formed seat codes", () => {
    expect(TOTAL_SEATS).toBe(50);
    expect(new Set(allSeatIds).size).toBe(TOTAL_SEATS);
    expect(allSeatIds).toEqual(
      expect.arrayContaining(["LA01", "UB02", "RW04", "BR08"]),
    );
    expect(allSeatIds.every((code) => /^[A-Z]{2}\d{2}$/.test(code))).toBe(true);
  });
});

describe("sample occupancy helpers", () => {
  it.each([
    ["2026-10-12T12:00:00", ["LA02", "UA03", "BR03", "RA01", "LW02", "RW03"]],
    ["2026-10-13T12:00:00", ["LA01", "LA05", "UA02", "UB01", "RC03", "BR07", "RW01"]],
    ["2026-10-14T12:00:00", ["LB02", "UA06", "RA04", "RB02", "BR01", "BR05", "RW04"]],
    ["2026-10-15T12:00:00", ["LA03", "LA07", "UA01", "LW01", "LW04", "RB04", "RC01", "RW02"]],
    ["2026-10-16T12:00:00", ["LB01", "LB03", "UA04", "UA08", "RA02", "BR02"]],
  ])("returns the expected weekday seats for %s", (date, expected) => {
    expect(getReservedSeatsForDate(date)).toEqual(expected);
  });

  it.each(["2026-10-17T12:00:00", "2026-10-18T12:00:00", "", "not-a-date"])(
    "returns no reservations for weekends or invalid input (%s)",
    (date) => {
      expect(getReservedSeatsForDate(date)).toEqual([]);
      expect(getOccupancyRateForDate(date)).toBe(0);
    },
  );

  it("rounds occupancy to a whole percentage", () => {
    expect(getOccupancyRateForDate("2026-10-12T12:00:00")).toBe(12);
    expect(getOccupancyRateForDate("2026-10-15T12:00:00")).toBe(16);
  });
});
