import { allSeatIds } from '@/app/admin/lib/seats';

export type PanoramaId = 'overview' | 'pods' | 'lounge' | 'study';
export type TourDirection = 'north' | 'south' | 'east' | 'west';

export const PANORAMA_IMAGES: Record<PanoramaId, string> = {
  overview: '/virtual/1_virtual.png',
  pods: '/virtual/2_virtual.png',
  lounge: '/virtual/3_virtual.png',
  study: '/virtual/4_virtual.png',
};

export function getPanoramaForSeat(seatId: string): PanoramaId {
  const zone = seatId.slice(0, 2);

  if (['LA', 'LB'].includes(zone)) return 'pods';
  if (['UA', 'UB', 'LW'].includes(zone)) return 'overview';
  if (['RA', 'RB'].includes(zone)) return 'lounge';
  return 'study';
}

export function getSeatZoneLabel(seatId: string): string {
  const zone = seatId.slice(0, 2);
  const labels: Record<string, string> = {
    LA: 'Left Area',
    LB: 'Left Bottom',
    UA: 'Upper Area',
    UB: 'Upper Booth',
    LW: 'Left Wall',
    RA: 'Right Area A',
    RB: 'Right Area B',
    RC: 'Right Area C',
    RW: 'Right Wall',
    BR: 'Bottom Row',
  };
  return labels[zone] ?? 'Study Hub';
}

/** Adjacency graph aligned with the floor plan layout */
export const seatLinks: Record<string, Partial<Record<TourDirection, string>>> = {
  LA01: { east: 'LA02', south: 'LA05' },
  LA02: { west: 'LA01', east: 'LA03', south: 'LA06' },
  LA03: { west: 'LA02', east: 'LA04', south: 'LA07' },
  LA04: { west: 'LA03', south: 'LA08', east: 'UA01' },
  LA05: { north: 'LA01', east: 'LA06', south: 'LB01' },
  LA06: { north: 'LA02', west: 'LA05', east: 'LA07', south: 'LB02' },
  LA07: { north: 'LA03', west: 'LA06', east: 'LA08', south: 'LB03' },
  LA08: { north: 'LA04', west: 'LA07', south: 'LB04' },

  LB01: { north: 'LA05', east: 'LB02' },
  LB02: { west: 'LB01', north: 'LA06', east: 'LB03' },
  LB03: { west: 'LB02', north: 'LA07', east: 'LB04' },
  LB04: { west: 'LB03', north: 'LA08' },

  UA01: { west: 'LA04', east: 'UA02', south: 'UA05' },
  UA02: { west: 'UA01', east: 'UA03', south: 'UA06' },
  UA03: { west: 'UA02', east: 'UA04', south: 'UA07' },
  UA04: { west: 'UA03', south: 'UA08', east: 'UB01' },
  UA05: { north: 'UA01', east: 'UA06', south: 'LW01' },
  UA06: { north: 'UA02', west: 'UA05', east: 'UA07' },
  UA07: { north: 'UA03', west: 'UA06', east: 'UA08', south: 'LW02' },
  UA08: { north: 'UA04', west: 'UA07', east: 'UB01', south: 'LW03' },
  UB01: { west: 'UA08', east: 'UB02', south: 'LW04' },
  UB02: { west: 'UB01' },

  LW01: { north: 'UA05', south: 'LW02', east: 'RA01' },
  LW02: { north: 'LW01', south: 'LW03', east: 'RA03' },
  LW03: { north: 'LW02', south: 'LW04', east: 'RA03' },
  LW04: { north: 'LW03', east: 'RA04' },

  RA01: { west: 'LW01', east: 'RA02', south: 'RA03' },
  RA02: { west: 'RA01', east: 'RB01', south: 'RA04' },
  RA03: { north: 'RA01', east: 'RA04', south: 'BR01', west: 'LW02' },
  RA04: { north: 'RA02', west: 'RA03', south: 'BR02', east: 'RB04' },

  RB01: { west: 'RA02', east: 'RB02', south: 'RB03' },
  RB02: { west: 'RA02', east: 'RC02', south: 'RB04' },
  RB03: { north: 'RB01', west: 'RA03', east: 'RB04', south: 'BR03' },
  RB04: { north: 'RB02', west: 'RA04', east: 'RC04', south: 'BR04' },

  RC01: { west: 'RB01', east: 'RC02', south: 'RC03' },
  RC02: { west: 'RB02', east: 'RW02', south: 'RC04' },
  RC03: { north: 'RC01', west: 'RB03', east: 'RC04', south: 'BR05' },
  RC04: { north: 'RC02', west: 'RB04', east: 'RW04', south: 'BR06' },

  RW01: { west: 'RC01', south: 'RW02' },
  RW02: { north: 'RW01', west: 'RC02', south: 'RW03' },
  RW03: { north: 'RW02', west: 'RC03', south: 'RW04' },
  RW04: { north: 'RW03', west: 'RC04', south: 'BR08' },

  BR01: { north: 'RA03', east: 'BR02' },
  BR02: { west: 'BR01', north: 'RA04', east: 'BR03' },
  BR03: { west: 'BR02', north: 'RB03', east: 'BR04' },
  BR04: { west: 'BR03', north: 'RB04', east: 'BR05' },
  BR05: { west: 'BR04', north: 'RC03', east: 'BR06' },
  BR06: { west: 'BR05', north: 'RC04', east: 'BR07' },
  BR07: { west: 'BR06', east: 'BR08' },
  BR08: { west: 'BR07', north: 'RW04' },
};

export function getNeighbor(seatId: string, direction: TourDirection): string | null {
  return seatLinks[seatId]?.[direction] ?? null;
}

export function getAvailableDirections(seatId: string): TourDirection[] {
  const links = seatLinks[seatId];
  if (!links) return [];
  return (['north', 'south', 'east', 'west'] as const).filter((dir) => links[dir]);
}

export const DEFAULT_TOUR_SEAT = 'UA03';

export const tourSeatIds = allSeatIds;
