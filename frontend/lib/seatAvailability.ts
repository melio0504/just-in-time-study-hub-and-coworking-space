const MANILA_UTC_OFFSET = "+08:00";

export const SEAT_AVAILABILITY_REFRESH_MS = 30_000;

export type SeatAvailabilityWindow = {
  startsAt: string;
  endsAt: string;
};

export type ReservedSeatWindowRow = {
  seat_code: string;
  starts_at: string;
  ends_at: string;
};

export type ReservedSeatWindow = {
  startsAt: string;
  endsAt: string;
};

const manilaTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const manilaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const getNextDateString = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1));
  return nextDate.toISOString().slice(0, 10);
};

export const getOperatingDayAvailabilityWindow = (date: string): SeatAvailabilityWindow => ({
  startsAt: new Date(`${date}T08:00:00${MANILA_UTC_OFFSET}`).toISOString(),
  endsAt: new Date(`${getNextDateString(date)}T05:00:00${MANILA_UTC_OFFSET}`).toISOString(),
});

export const getReservationAvailabilityWindow = (
  date: string,
  time: string,
  durationHours: string,
): SeatAvailabilityWindow => {
  const parsedDuration = Number(durationHours);

  if (!time || !Number.isFinite(parsedDuration) || parsedDuration <= 0) {
    return getOperatingDayAvailabilityWindow(date);
  }

  const start = new Date(`${date}T${time.padStart(5, "0")}:00${MANILA_UTC_OFFSET}`);
  const end = new Date(start.getTime() + parsedDuration * 60 * 60 * 1000);

  return {
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
  };
};

export const getSeatSelectionAvailabilityWindow = (
  date: string,
  time: string,
  durationHours: string,
  minimumDurationHours: number,
): SeatAvailabilityWindow =>
  getReservationAvailabilityWindow(
    date,
    time,
    time ? durationHours || String(minimumDurationHours) : "",
  );

export const groupReservedSeatWindows = (
  rows: ReservedSeatWindowRow[],
): Record<string, ReservedSeatWindow[]> =>
  rows.reduce<Record<string, ReservedSeatWindow[]>>((windowsBySeat, row) => {
    windowsBySeat[row.seat_code] ??= [];
    windowsBySeat[row.seat_code].push({
      startsAt: row.starts_at,
      endsAt: row.ends_at,
    });
    return windowsBySeat;
  }, {});

export const formatReservedSeatWindow = ({ startsAt, endsAt }: ReservedSeatWindow): string => {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const endsNextDay = manilaDateFormatter.format(start) !== manilaDateFormatter.format(end);

  return `${manilaTimeFormatter.format(start)} – ${manilaTimeFormatter.format(end)}${endsNextDay ? " (next day)" : ""}`;
};

export const isReservationWindowFullyReserved = (
  windowsBySeat: Record<string, ReservedSeatWindow[]>,
  seatIds: string[],
  { startsAt, endsAt }: SeatAvailabilityWindow,
): boolean => {
  if (seatIds.length === 0) return false;

  const requestedStart = new Date(startsAt).getTime();
  const requestedEnd = new Date(endsAt).getTime();

  return seatIds.every((seatId) =>
    (windowsBySeat[seatId] ?? []).some((reservedWindow) => {
      const reservedStart = new Date(reservedWindow.startsAt).getTime();
      const reservedEnd = new Date(reservedWindow.endsAt).getTime();
      return reservedStart < requestedEnd && reservedEnd > requestedStart;
    }),
  );
};
