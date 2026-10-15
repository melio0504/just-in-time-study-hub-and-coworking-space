const MANILA_TIME_ZONE = 'Asia/Manila';
const MANILA_UTC_OFFSET = '+08:00';

export const getManilaDateString = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const getPart = (type: Intl.DateTimeFormatPartTypes) => (
    parts.find((part) => part.type === type)?.value ?? ''
  );

  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
};

export const isReservationTimePast = (
  date: string,
  time: string,
  now = new Date(),
) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return true;
  }

  const startsAt = new Date(`${date}T${time}:00${MANILA_UTC_OFFSET}`);
  return Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= now.getTime();
};
