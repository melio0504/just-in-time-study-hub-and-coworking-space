export const STUDY_HISTORY_DAYS = 364;

export type BookingActivity = {
  booking_date: string;
  duration_hours: number;
};

export type StudyDay = {
  date: string;
  hours: number;
  level: number;
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getStudyHistoryDateRange(today = new Date()) {
  const startDate = new Date(today);
  startDate.setHours(12, 0, 0, 0);
  startDate.setDate(startDate.getDate() - (STUDY_HISTORY_DAYS - 1));

  return {
    startDate: toDateKey(startDate),
    endDate: toDateKey(today),
  };
}

function getActivityLevel(hours: number) {
  return hours > 0 ? 1 : 0;
}

export function buildStudyHistory(bookings: BookingActivity[], today = new Date()): StudyDay[] {
  const hoursByDate = bookings.reduce((totals, booking) => {
    totals.set(
      booking.booking_date,
      (totals.get(booking.booking_date) ?? 0) + booking.duration_hours,
    );
    return totals;
  }, new Map<string, number>());

  const startDate = new Date(today);
  startDate.setHours(12, 0, 0, 0);
  startDate.setDate(startDate.getDate() - (STUDY_HISTORY_DAYS - 1));

  return Array.from({ length: STUDY_HISTORY_DAYS }, (_, dayIndex) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + dayIndex);
    const dateKey = toDateKey(date);
    const hours = hoursByDate.get(dateKey) ?? 0;

    return {
      date: dateKey,
      hours,
      level: getActivityLevel(hours),
    };
  });
}
