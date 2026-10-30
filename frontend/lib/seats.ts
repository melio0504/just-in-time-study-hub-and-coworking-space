export const allSeatIds = [
  ...[
    "SO01",
    "SO02",
    "SO03",
    "SO04",
    "SO05",
    "SO06",
    "SO07",
    "SO08",
    "SO09",
    "SO10",
    "SO11",
    "SO12",
  ],
  ...["FD01", "FD02", "FD03", "FD04", "FD05", "FD06", "FD07", "FD08", "FD09", "FD10"],
  ...[
    "GS01",
    "GS02",
    "GS03",
    "GS04",
    "GS05",
    "GS06",
    "GS07",
    "GS08",
    "GS09",
    "GS10",
    "GS11",
    "GS12",
  ],
  ...[
    "HC01",
    "HC02",
    "HC03",
    "HC04",
    "HC05",
    "HC06",
    "HC07",
    "HC08",
    "HC09",
    "HC10",
    "HC11",
    "HC12",
    "HC13",
    "HC14",
    "HC15",
    "HC16",
  ],
];

export const TOTAL_SEATS = allSeatIds.length;

export const getReservedSeatsForDate = (date: string): string[] => {
  if (!date) return [];

  const dateObj = new Date(date);
  const dayOfWeek = dateObj.getDay();

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return [];
  }

  if (dayOfWeek === 1) {
    return ["SO02", "FD03", "HC07", "GS01", "HC02", "HC15"];
  }
  if (dayOfWeek === 2) {
    return ["SO01", "SO05", "FD02", "FD09", "GS11", "HC11", "HC13"];
  }
  if (dayOfWeek === 3) {
    return ["SO10", "FD06", "GS04", "GS06", "HC05", "HC09", "HC16"];
  }
  if (dayOfWeek === 4) {
    return ["SO03", "SO07", "FD01", "HC01", "HC04", "GS08", "GS09", "HC14"];
  }
  if (dayOfWeek === 5) {
    return ["SO09", "SO11", "FD04", "FD08", "GS02", "HC06"];
  }

  return [];
};

export const getOccupancyRateForDate = (date: string): number => {
  const reserved = getReservedSeatsForDate(date).length;
  if (reserved === 0 && (new Date(date).getDay() === 0 || new Date(date).getDay() === 6)) {
    return 0;
  }
  return Math.round((reserved / TOTAL_SEATS) * 100);
};
