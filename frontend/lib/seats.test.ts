import { describe, expect, it } from "vitest";

import { allSeatIds, getOccupancyRateForDate, getReservedSeatsForDate, TOTAL_SEATS } from "./seats";

describe("seat catalogue", () => {
  it("contains 50 unique, well-formed seat codes", () => {
    expect(TOTAL_SEATS).toBe(50);
    expect(new Set(allSeatIds).size).toBe(TOTAL_SEATS);
    expect(allSeatIds).toEqual(expect.arrayContaining(["SO01", "FD10", "GS12", "HC16"]));
    expect(allSeatIds.every((code) => /^[A-Z]{2}\d{2}$/.test(code))).toBe(true);
  });
});

describe("sample occupancy helpers", () => {
  it.each([
    ["2026-10-12T12:00:00", ["SO02", "FD03", "HC07", "GS01", "HC02", "HC15"]],
    ["2026-10-13T12:00:00", ["SO01", "SO05", "FD02", "FD09", "GS11", "HC11", "HC13"]],
    ["2026-10-14T12:00:00", ["SO10", "FD06", "GS04", "GS06", "HC05", "HC09", "HC16"]],
    ["2026-10-15T12:00:00", ["SO03", "SO07", "FD01", "HC01", "HC04", "GS08", "GS09", "HC14"]],
    ["2026-10-16T12:00:00", ["SO09", "SO11", "FD04", "FD08", "GS02", "HC06"]],
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
