import { describe, expect, it } from "vitest";

import {
  findEnabledReservationOptionIndex,
  getReservationDropdownLayout,
} from "./reservation-dropdown";

describe("getReservationDropdownLayout", () => {
  it("opens below when the available space fits the menu", () => {
    expect(
      getReservationDropdownLayout({
        optionCount: 8,
        triggerBottom: 148,
        triggerTop: 100,
        viewportHeight: 800,
      }),
    ).toEqual({ maxHeight: 240, opensAbove: false });
  });

  it("opens above when there is more room above the trigger", () => {
    expect(
      getReservationDropdownLayout({
        optionCount: 8,
        triggerBottom: 548,
        triggerTop: 500,
        viewportHeight: 640,
      }),
    ).toEqual({ maxHeight: 240, opensAbove: true });
  });
});

describe("findEnabledReservationOptionIndex", () => {
  const options = [
    ["", "All operating day"],
    ["08:00", "8:00 AM", true],
    ["09:00", "9:00 AM"],
  ] as const;

  it("skips disabled options while moving forward", () => {
    expect(findEnabledReservationOptionIndex([...options], 1, 1)).toBe(2);
  });

  it("keeps the all-day option keyboard accessible", () => {
    expect(findEnabledReservationOptionIndex([...options], 0, 1)).toBe(0);
  });
});
