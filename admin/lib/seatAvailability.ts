const MANILA_UTC_OFFSET = '+08:00';

export const SEAT_AVAILABILITY_REFRESH_MS = 30_000;

export type SeatAvailabilityWindow = {
  startsAt: string;
  endsAt: string;
};

const getNextDateString = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
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

  const start = new Date(`${date}T${time.padStart(5, '0')}:00${MANILA_UTC_OFFSET}`);
  const end = new Date(start.getTime() + parsedDuration * 60 * 60 * 1000);

  return {
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
  };
};
