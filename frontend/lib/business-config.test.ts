import { describe, expect, it } from 'vitest';

import {
  closureForDate,
  hoursAvailableFrom,
  isRegularlyClosedDate,
  maximumBookingDate,
  meetsMinimumNotice,
  operatingDateForBooking,
  reservationDateForTime,
  reservationTimeOptions,
  type BusinessHours,
} from './business-config';

const dailyHours: BusinessHours[] = Array.from({ length: 7 }, (_, day) => ({
  day_of_week: day,
  is_open: true,
  opens_at: '08:00:00',
  closes_at: '05:00:00',
}));

describe('business configuration helpers', () => {
  it('supports operating windows that continue after midnight', () => {
    expect(hoursAvailableFrom('2026-10-16', '08:00', dailyHours)).toBe(21);
    expect(hoursAvailableFrom('2026-10-16', '23:00', dailyHours)).toBe(6);
    expect(hoursAvailableFrom('2026-10-16', '02:00', dailyHours)).toBe(3);
    expect(hoursAvailableFrom('2026-10-16', '06:00', dailyHours)).toBe(0);
  });

  it('generates only hourly times when the hub is open', () => {
    const times = reservationTimeOptions('2026-10-16', dailyHours).map(([value]) => value);
    expect(times[0]).toBe('08:00');
    expect(times.at(-1)).toBe('04:00');
    expect(times.indexOf('23:00')).toBeLessThan(times.indexOf('00:00'));
    expect(times).not.toContain('06:00');
  });

  it('maps after-midnight choices to the next calendar date', () => {
    expect(reservationDateForTime('2026-10-16', '01:00', dailyHours)).toBe('2026-10-17');
    expect(reservationDateForTime('2026-10-16', '23:00', dailyHours)).toBe('2026-10-16');
    expect(operatingDateForBooking('2026-10-17', '01:00', dailyHours)).toBe('2026-10-16');
  });

  it('identifies dates whose weekday is closed in the regular schedule', () => {
    const weeklyHours = dailyHours.map((hours) => (
      hours.day_of_week === 5 ? { ...hours, is_open: false } : hours
    ));

    expect(isRegularlyClosedDate('2026-10-16', weeklyHours)).toBe(true);
    expect(isRegularlyClosedDate('2026-10-17', weeklyHours)).toBe(false);
  });

  it('finds active closure date ranges', () => {
    expect(closureForDate('2026-12-25', [{
      id: 1,
      name: 'Christmas closure',
      closure_type: 'holiday',
      starts_on: '2026-12-24',
      ends_on: '2026-12-26',
      is_active: true,
    }])?.name).toBe('Christmas closure');
  });

  it('calculates the last date allowed by the booking window', () => {
    expect(maximumBookingDate('2026-10-16', 30)).toBe('2026-11-15');
  });

  it('applies the configured minimum notice in Manila time', () => {
    const now = new Date('2026-10-16T01:00:00.000Z'); // 9:00 AM in Manila
    expect(meetsMinimumNotice('2026-10-16', '10:00', 60, now)).toBe(true);
    expect(meetsMinimumNotice('2026-10-16', '09:00', 60, now)).toBe(false);
  });
});
