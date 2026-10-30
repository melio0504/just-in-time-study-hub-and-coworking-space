import { describe, expect, it } from "vitest";

import {
  findEnabledReservationOptionIndex,
  getReservationDropdownLayout,
  startsNextReservationDay,
} from "./reservation-dropdown";

describe("startsNextReservationDay", () => {
  it("separates the next day when the clock wraps after midnight", () => {
    expect(startsNextReservationDay("23:00", "00:00")).toBe(true);
  });

  it("keeps consecutive same-day hours in the same visual group", () => {
    expect(startsNextReservationDay("08:00", "09:00")).toBe(false);
  });
});

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

  it("opens above once when there is more room above the trigger", () => {
    expect(
      getReservationDropdownLayout({
        optionCount: 8,
        triggerBottom: 548,
        triggerTop: 500,
        viewportHeight: 640,
      }),
    ).toEqual({ maxHeight: 240, opensAbove: true });
  });

  it("caps the menu to the chosen side instead of overflowing the viewport", () => {
    expect(
      getReservationDropdownLayout({
        optionCount: 8,
        triggerBottom: 128,
        triggerTop: 80,
        viewportHeight: 200,
      }),
    ).toEqual({ maxHeight: 64, opensAbove: true });
  });
});

describe("findEnabledReservationOptionIndex", () => {
  const options = [
    ["08:00", "8:00 AM", true],
    ["09:00", "9:00 AM (Reserved)", true],
    ["10:00", "10:00 AM", false],
  ] as const;

  it("skips reserved options while moving forward", () => {
    expect(findEnabledReservationOptionIndex([...options], 0, 1)).toBe(2);
  });

  it("returns no index when every remaining option is reserved", () => {
    expect(findEnabledReservationOptionIndex([...options], 1, -1)).toBe(-1);
  });
});
