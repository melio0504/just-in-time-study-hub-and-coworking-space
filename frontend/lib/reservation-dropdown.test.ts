import { describe, expect, it } from "vitest";

import {
  getReservationDropdownLayout,
  hasReservationTimeGap,
} from "./reservation-dropdown";

describe("hasReservationTimeGap", () => {
  it("separates the overnight closing time from the morning opening time", () => {
    expect(hasReservationTimeGap("04:00", "08:00")).toBe(true);
  });

  it("keeps consecutive hours in the same visual group", () => {
    expect(hasReservationTimeGap("03:00", "04:00")).toBe(false);
  });
});

describe("getReservationDropdownLayout", () => {
  it("opens below when the available space fits the menu", () => {
    expect(getReservationDropdownLayout({
      optionCount: 8,
      triggerBottom: 148,
      triggerTop: 100,
      viewportHeight: 800,
    })).toEqual({ maxHeight: 240, opensAbove: false });
  });

  it("opens above once when there is more room above the trigger", () => {
    expect(getReservationDropdownLayout({
      optionCount: 8,
      triggerBottom: 548,
      triggerTop: 500,
      viewportHeight: 640,
    })).toEqual({ maxHeight: 240, opensAbove: true });
  });

  it("caps the menu to the chosen side instead of overflowing the viewport", () => {
    expect(getReservationDropdownLayout({
      optionCount: 8,
      triggerBottom: 128,
      triggerTop: 80,
      viewportHeight: 200,
    })).toEqual({ maxHeight: 64, opensAbove: true });
  });
});
