export type BusinessHours = {
  day_of_week: number;
  is_open: boolean;
  opens_at: string;
  closes_at: string;
};

export type BusinessClosure = {
  id: number;
  name: string;
  starts_on: string;
  ends_on: string;
  closure_type: string;
  is_active: boolean;
};

export type BookingSettings = {
  max_seats_per_booking: number;
  min_duration_hours: number;
  max_duration_hours: number;
  minimum_notice_minutes: number;
  maximum_advance_days: number;
};

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  max_seats_per_booking: 5,
  min_duration_hours: 1,
  max_duration_hours: 24,
  minimum_notice_minutes: 60,
  maximum_advance_days: 90,
};

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const normalizedTime = (value: string) => value.slice(0, 5);

const minutesForTime = (value: string) => {
  const [hour, minute] = normalizedTime(value).split(':').map(Number);
  return hour * 60 + minute;
};

const dateFromString = (value: string) => new Date(`${value}T12:00:00`);

const previousDateString = (value: string) => {
  const date = dateFromString(value);
  date.setDate(date.getDate() - 1);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

const nextDateString = (value: string) => {
  const date = dateFromString(value);
  date.setDate(date.getDate() + 1);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

export function formatTime(value: string) {
  const [hour, minute] = normalizedTime(value).split(':').map(Number);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export function formatHoursRange(hours: BusinessHours) {
  return hours.is_open
    ? `${formatTime(hours.opens_at)} – ${formatTime(hours.closes_at)}`
    : 'Closed';
}

export function hoursAvailableFrom(
  date: string,
  time: string,
  weeklyHours: BusinessHours[],
) {
  const startMinutes = minutesForTime(time);
  const currentDay = dateFromString(date).getDay();
  const currentHours = weeklyHours.find((hours) => hours.day_of_week === currentDay);

  if (currentHours?.is_open) {
    const opens = minutesForTime(currentHours.opens_at);
    const closes = minutesForTime(currentHours.closes_at);
    if (opens < closes && startMinutes >= opens && startMinutes < closes) {
      return Math.floor((closes - startMinutes) / 60);
    }
    if (opens > closes && startMinutes >= opens) {
      return Math.floor((1440 - startMinutes + closes) / 60);
    }
    if (opens > closes && startMinutes < closes) {
      return Math.floor((closes - startMinutes) / 60);
    }
  }

  return 0;
}

export function reservationTimeOptions(date: string, weeklyHours: BusinessHours[]) {
  const currentDay = dateFromString(date).getDay();
  const currentHours = weeklyHours.find((hours) => hours.day_of_week === currentDay);
  if (!currentHours?.is_open) return [];

  const opens = minutesForTime(currentHours.opens_at);

  return Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`)
    .filter((time) => hoursAvailableFrom(date, time, weeklyHours) > 0)
    .sort((left, right) => {
      const leftMinutes = minutesForTime(left);
      const rightMinutes = minutesForTime(right);
      const leftOperatingMinutes = leftMinutes < opens ? leftMinutes + 1440 : leftMinutes;
      const rightOperatingMinutes = rightMinutes < opens ? rightMinutes + 1440 : rightMinutes;
      return leftOperatingMinutes - rightOperatingMinutes;
    })
    .map((time) => [time, formatTime(time)] as const);
}

export function reservationDateForTime(
  operatingDate: string,
  time: string,
  weeklyHours: BusinessHours[],
) {
  const hours = weeklyHours.find(
    (item) => item.day_of_week === dateFromString(operatingDate).getDay(),
  );
  if (!hours?.is_open) return operatingDate;

  const opens = minutesForTime(hours.opens_at);
  const closes = minutesForTime(hours.closes_at);
  const start = minutesForTime(time);
  return opens > closes && start < closes
    ? nextDateString(operatingDate)
    : operatingDate;
}

export function operatingDateForBooking(
  bookingDate: string,
  time: string,
  weeklyHours: BusinessHours[],
) {
  const previousDate = previousDateString(bookingDate);
  const previousHours = weeklyHours.find(
    (hours) => hours.day_of_week === dateFromString(previousDate).getDay(),
  );
  if (!previousHours?.is_open) return bookingDate;

  const opens = minutesForTime(previousHours.opens_at);
  const closes = minutesForTime(previousHours.closes_at);
  const start = minutesForTime(time);
  return opens > closes && start < closes ? previousDate : bookingDate;
}

export function isRegularlyClosedDate(date: string, weeklyHours: BusinessHours[]) {
  const hours = weeklyHours.find(
    (item) => item.day_of_week === dateFromString(date).getDay(),
  );
  return hours?.is_open === false;
}

export function isClosureDate(date: string, closures: BusinessClosure[]) {
  return closures.some((closure) => (
    closure.is_active && date >= closure.starts_on && date <= closure.ends_on
  ));
}

export function closureForDate(date: string, closures: BusinessClosure[]) {
  return closures.find((closure) => (
    closure.is_active && date >= closure.starts_on && date <= closure.ends_on
  ));
}

export function maximumBookingDate(today: string, advanceDays: number) {
  const date = dateFromString(today);
  date.setDate(date.getDate() + advanceDays);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function meetsMinimumNotice(
  date: string,
  time: string,
  minimumNoticeMinutes: number,
  now = new Date(),
) {
  const startsAt = new Date(`${date}T${normalizedTime(time)}:00+08:00`);
  return startsAt.getTime() >= now.getTime() + minimumNoticeMinutes * 60_000;
}
