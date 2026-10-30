import { describe, expect, it } from "vitest";

import {
  allSeatIds as frontendSeatIds,
  TOTAL_SEATS as frontendTotal,
  getReservedSeatsForDate as getFrontendReservedSeats,
} from "../../frontend/lib/seats";
import { allSeatIds, getOccupancyRateForDate, getReservedSeatsForDate, TOTAL_SEATS } from "./seats";

describe("admin seat catalogue contract", () => {
  it("stays in sync with the public application", () => {
    expect(TOTAL_SEATS).toBe(frontendTotal);
    expect(allSeatIds).toEqual(frontendSeatIds);

    for (const date of ["2026-10-12T12:00:00", "2026-10-15T12:00:00", "2026-10-18T12:00:00"]) {
      expect(getReservedSeatsForDate(date)).toEqual(getFrontendReservedSeats(date));
    }
  });

  it.each([
    ["2026-10-12T12:00:00", 6, 12],
    ["2026-10-13T12:00:00", 7, 14],
    ["2026-10-14T12:00:00", 7, 14],
    ["2026-10-15T12:00:00", 8, 16],
    ["2026-10-16T12:00:00", 6, 12],
    ["2026-10-17T12:00:00", 0, 0],
    ["2026-10-18T12:00:00", 0, 0],
    ["", 0, 0],
  ])("calculates occupancy for %s", (date, reservedCount, rate) => {
    expect(getReservedSeatsForDate(date)).toHaveLength(reservedCount);
    expect(getOccupancyRateForDate(date)).toBe(rate);
  });
});
