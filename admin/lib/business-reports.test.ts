import { describe, expect, it } from "vitest";
import {
  currentBusinessDateKey,
  formatReportPeriod,
  getReportRange,
  type ReportMetric,
  summarizeReport,
} from "./business-reports";

describe("getReportRange", () => {
  it("uses the 8 AM Manila business-day cutoff", () => {
    expect(currentBusinessDateKey(new Date("2026-10-11T17:30:00Z"))).toBe("2026-10-11");
    expect(currentBusinessDateKey(new Date("2026-10-12T00:30:00Z"))).toBe("2026-10-12");
  });

  it("builds daily, Monday-to-Sunday weekly, monthly, and yearly ranges", () => {
    expect(getReportRange("daily", "2026-10-12")).toEqual({
      startDate: "2026-10-12",
      endDate: "2026-10-12",
    });
    expect(getReportRange("weekly", "2026-10-14")).toEqual({
      startDate: "2026-10-12",
      endDate: "2026-10-18",
    });
    expect(getReportRange("monthly", "2026-10-14")).toEqual({
      startDate: "2026-10-01",
      endDate: "2026-10-31",
    });
    expect(getReportRange("yearly", "2026-10-14")).toEqual({
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
  });

  it("formats a readable reporting period", () => {
    expect(formatReportPeriod("monthly", "2026-10-01", "2026-10-31")).toBe("October 2026");
  });
});

describe("summarizeReport", () => {
  it("combines revenue, visits, payments, and utilization", () => {
    const base = {
      report_date: "2026-10-12",
      reservation_count: 2,
      walk_in_count: 3,
      total_visits: 5,
      reservation_revenue_cents: 20000,
      walk_in_revenue_cents: 15000,
      revenue_cents: 35000,
      reservation_checkins: 2,
      walk_in_checkins: 3,
      checkins_count: 5,
      reservation_seat_hours: 4,
      walk_in_seat_hours: 6,
      occupied_seat_hours: 10,
      available_seat_hours: 100,
      outstanding_walk_in_cents: 5000,
      cash_revenue_cents: 10000,
      gcash_revenue_cents: 5000,
      qrph_revenue_cents: 0,
      other_revenue_cents: 0,
    } satisfies ReportMetric;
    const totals = summarizeReport([base, { ...base, report_date: "2026-10-13" }]);

    expect(totals.revenue).toBe(70000);
    expect(totals.visits).toBe(10);
    expect(totals.occupancy).toBe(10);
    expect(totals.averageDailyRevenue).toBe(35000);
  });
});
