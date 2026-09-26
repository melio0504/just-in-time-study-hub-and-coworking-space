export const allSeatIds = [
  ...['LA01', 'LA02', 'LA03', 'LA04', 'LA05', 'LA06', 'LA07', 'LA08'],
  ...['LB01', 'LB02', 'LB03', 'LB04'],
  ...['UA01', 'UA02', 'UA03', 'UA04', 'UA05', 'UA06', 'UA07', 'UA08'],
  ...['UB01', 'UB02'],
  ...['LW01', 'LW02', 'LW03', 'LW04'],
  ...['RA01', 'RA02', 'RA03', 'RA04'],
  ...['RB01', 'RB02', 'RB03', 'RB04'],
  ...['RC01', 'RC02', 'RC03', 'RC04'],
  ...['RW01', 'RW02', 'RW03', 'RW04'],
  ...['BR01', 'BR02', 'BR03', 'BR04', 'BR05', 'BR06', 'BR07', 'BR08'],
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
    return ['LA02', 'UA03', 'BR03', 'RA01', 'LW02', 'RW03'];
  }
  if (dayOfWeek === 2) {
    return ['LA01', 'LA05', 'UA02', 'UB01', 'RC03', 'BR07', 'RW01'];
  }
  if (dayOfWeek === 3) {
    return ['LB02', 'UA06', 'RA04', 'RB02', 'BR01', 'BR05', 'RW04'];
  }
  if (dayOfWeek === 4) {
    return ['LA03', 'LA07', 'UA01', 'LW01', 'LW04', 'RB04', 'RC01', 'RW02'];
  }
  if (dayOfWeek === 5) {
    return ['LB01', 'LB03', 'UA04', 'UA08', 'RA02', 'BR02'];
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
