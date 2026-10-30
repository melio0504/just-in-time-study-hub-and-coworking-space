import { describe, expect, it } from "vitest";

import { buildStudyHistory, getStudyHistoryDateRange, STUDY_HISTORY_DAYS } from "./study-history";

const TODAY = new Date(2026, 9, 12, 12);

describe("getStudyHistoryDateRange", () => {
  it("returns the inclusive 364-day range shown in the graph", () => {
    expect(getStudyHistoryDateRange(TODAY)).toEqual({
      startDate: "2025-10-14",
      endDate: "2026-10-12",
    });
  });
});

describe("buildStudyHistory", () => {
  it("marks booking dates and combines bookings made for the same day", () => {
    const history = buildStudyHistory(
      [
        { booking_date: "2026-10-10", duration_hours: 2 },
        { booking_date: "2026-10-10", duration_hours: 3 },
        { booking_date: "2026-10-12", duration_hours: 1 },
      ],
      TODAY,
    );

    expect(history).toHaveLength(STUDY_HISTORY_DAYS);
    expect(history.find((day) => day.date === "2026-10-10")).toEqual({
      date: "2026-10-10",
      hours: 5,
      level: 1,
    });
    expect(history.at(-1)).toEqual({
      date: "2026-10-12",
      hours: 1,
      level: 1,
    });
  });

  it("keeps dates without bookings uncolored", () => {
    const history = buildStudyHistory([], TODAY);

    expect(history.every((day) => day.hours === 0 && day.level === 0)).toBe(true);
  });

  it("uses one booked state regardless of the number of booked hours", () => {
    const history = buildStudyHistory(
      [
        { booking_date: "2026-10-08", duration_hours: 2 },
        { booking_date: "2026-10-09", duration_hours: 3 },
        { booking_date: "2026-10-10", duration_hours: 5 },
        { booking_date: "2026-10-11", duration_hours: 9 },
      ],
      TODAY,
    );

    expect(history.slice(-5, -1).map((day) => day.level)).toEqual([1, 1, 1, 1]);
  });
});
