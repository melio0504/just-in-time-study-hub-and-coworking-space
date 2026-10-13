export const VIRTUAL_PANORAMA_WIDTH = 2172;
export const VIRTUAL_PANORAMA_HEIGHT = 724;

export type VirtualSeatMarker = {
  code: string;
  x: number;
  y: number;
  xOffset?: number;
  yOffset?: number;
};

/** Seat anchors measured against public/virtual/1_virtual.png. */
const POD_SEAT_MARKERS: VirtualSeatMarker[] = [
  { code: 'SO01', x: 104, y: 507 },
  { code: 'SO02', x: 208, y: 425 },
  { code: 'SO03', x: 250, y: 399, xOffset: -45, yOffset: -25 },
  { code: 'SO04', x: 282, y: 368, xOffset: -45 },
  { code: 'SO05', x: 462, y: 363 },
  { code: 'SO06', x: 515, y: 368 },
  { code: 'SO07', x: 595, y: 381 },
  { code: 'SO08', x: 627, y: 356 },
  { code: 'SO09', x: 676, y: 363 },
  { code: 'SO10', x: 712, y: 409 },
  { code: 'SO11', x: 743, y: 371 },
  { code: 'SO12', x: 836, y: 371 },
];

/** Seat anchors measured against public/virtual/2_virtual.png. */
const OVERVIEW_SEAT_MARKERS: VirtualSeatMarker[] = [
  { code: 'SO01', x: 295, y: 402, xOffset: -45 },
  { code: 'SO02', x: 320, y: 389, xOffset: -45 },
  { code: 'SO03', x: 343, y: 366, xOffset: -45 },
  { code: 'SO04', x: 362, y: 351, xOffset: -45 },
  { code: 'SO05', x: 419, y: 356 },
  { code: 'SO06', x: 440, y: 361 },
  { code: 'SO07', x: 464, y: 366 },
  { code: 'SO08', x: 488, y: 382 },
  { code: 'SO09', x: 542, y: 351 },
  { code: 'SO10', x: 569, y: 356 },
  { code: 'SO11', x: 605, y: 366 },
  { code: 'SO12', x: 640, y: 368 },
  { code: 'HC05', x: 1255, y: 380 },
  { code: 'HC06', x: 1300, y: 449 },
  { code: 'HC07', x: 1336, y: 376 },
  { code: 'HC08', x: 1407, y: 370 },
  { code: 'HC09', x: 1407, y: 420 },
  { code: 'HC10', x: 1479, y: 366 },
  { code: 'HC11', x: 1535, y: 413 },
  { code: 'HC12', x: 1605, y: 382 },
];

/**
 * Seat anchors measured against public/virtual/3_virtual.png. HC05–HC12 are
 * the same high chairs shown in the overview from a different viewpoint.
 */
const LOUNGE_SEAT_MARKERS: VirtualSeatMarker[] = [
  { code: 'HC05', x: 916, y: 415 },
  { code: 'HC06', x: 943, y: 358 },
  { code: 'HC07', x: 1109, y: 348 },
  { code: 'HC08', x: 1138, y: 405 },
  { code: 'HC09', x: 1282, y: 341 },
  { code: 'HC10', x: 1341, y: 344 },
  { code: 'HC11', x: 1385, y: 395 },
  { code: 'HC12', x: 1486, y: 365 },
  { code: 'GS01', x: 1788, y: 370 },
  { code: 'GS02', x: 1826, y: 385 },
  { code: 'GS03', x: 1858, y: 359 },
  { code: 'GS04', x: 1892, y: 327 },
  { code: 'GS05', x: 1926, y: 328 },
  { code: 'GS06', x: 1936, y: 371 },
  { code: 'GS07', x: 1957, y: 338 },
];

/** Seat anchors measured against public/virtual/4_virtual.png. */
const STUDY_SEAT_MARKERS: VirtualSeatMarker[] = [
  { code: 'FD01', x: 623, y: 466 },
  { code: 'FD02', x: 670, y: 397 },
  { code: 'FD03', x: 675, y: 364 },
  { code: 'FD04', x: 696, y: 344 },
  { code: 'FD05', x: 716, y: 334 },
  { code: 'FD06', x: 722, y: 305 },
  { code: 'FD07', x: 736, y: 324 },
  { code: 'FD08', x: 760, y: 305 },
  { code: 'FD09', x: 778, y: 325 },
  { code: 'FD10', x: 787, y: 346 },
  { code: 'HC01', x: 798, y: 371 },
  { code: 'HC02', x: 805, y: 306 },
  { code: 'HC03', x: 840, y: 397 },
  { code: 'HC04', x: 851, y: 305 },
  { code: 'GS01', x: 892, y: 304 },
  { code: 'GS02', x: 912, y: 304 },
  { code: 'GS03', x: 932, y: 305 },
  { code: 'GS04', x: 935, y: 481 },
  { code: 'GS05', x: 952, y: 314 },
  { code: 'GS06', x: 988, y: 313 },
  { code: 'GS07', x: 1051, y: 325 },
  { code: 'GS08', x: 1122, y: 326 },
  { code: 'GS09', x: 1231, y: 334 },
  { code: 'GS10', x: 1377, y: 341 },
  { code: 'GS11', x: 1505, y: 336 },
  { code: 'GS12', x: 1630, y: 346 },
  { code: 'HC13', x: 1704, y: 361 },
  { code: 'HC14', x: 1859, y: 389 },
];

export const VIRTUAL_SEAT_MARKERS_BY_PANORAMA: Partial<Record<string, VirtualSeatMarker[]>> = {
  pods: POD_SEAT_MARKERS,
  overview: OVERVIEW_SEAT_MARKERS,
  lounge: LOUNGE_SEAT_MARKERS,
  study: STUDY_SEAT_MARKERS,
};

export const VIRTUAL_SEAT_MARKERS = [
  ...POD_SEAT_MARKERS,
  ...OVERVIEW_SEAT_MARKERS,
  ...LOUNGE_SEAT_MARKERS,
  ...STUDY_SEAT_MARKERS,
];
