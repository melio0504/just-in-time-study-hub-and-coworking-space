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
  { code: 'LA01', x: 104, y: 507 },
  { code: 'LA02', x: 208, y: 425 },
  { code: 'LA03', x: 250, y: 399, xOffset: -45, yOffset: -25 },
  { code: 'LA04', x: 282, y: 368, xOffset: -45 },
  { code: 'LA05', x: 462, y: 363 },
  { code: 'LA06', x: 515, y: 368 },
  { code: 'LA07', x: 595, y: 381 },
  { code: 'LA08', x: 627, y: 356 },
  { code: 'LB01', x: 676, y: 363 },
  { code: 'LB02', x: 712, y: 409 },
  { code: 'LB03', x: 743, y: 371 },
  { code: 'LB04', x: 836, y: 371 },
];

/** Seat anchors measured against public/virtual/2_virtual.png. */
const OVERVIEW_SEAT_MARKERS: VirtualSeatMarker[] = [
  { code: 'LA01', x: 295, y: 402, xOffset: -45 },
  { code: 'LA02', x: 320, y: 389, xOffset: -45 },
  { code: 'LA03', x: 343, y: 366, xOffset: -45 },
  { code: 'LA04', x: 362, y: 351, xOffset: -45 },
  { code: 'LA05', x: 419, y: 356 },
  { code: 'LA06', x: 440, y: 361 },
  { code: 'LA07', x: 464, y: 366 },
  { code: 'LA08', x: 488, y: 382 },
  { code: 'LB01', x: 542, y: 351 },
  { code: 'LB02', x: 569, y: 356 },
  { code: 'LB03', x: 605, y: 366 },
  { code: 'LB04', x: 640, y: 368 },
  { code: 'BR01', x: 1255, y: 380 },
  { code: 'BR02', x: 1300, y: 449 },
  { code: 'BR03', x: 1336, y: 376 },
  { code: 'BR04', x: 1407, y: 370 },
  { code: 'BR05', x: 1407, y: 420 },
  { code: 'BR06', x: 1479, y: 366 },
  { code: 'BR07', x: 1535, y: 413 },
  { code: 'BR08', x: 1605, y: 382 },
];

/**
 * Seat anchors measured against public/virtual/3_virtual.png. BR01–BR08 are
 * the same lounge seats shown in the overview from a different viewpoint.
 */
const LOUNGE_SEAT_MARKERS: VirtualSeatMarker[] = [
  { code: 'BR01', x: 916, y: 415 },
  { code: 'BR02', x: 943, y: 358 },
  { code: 'BR03', x: 1109, y: 348 },
  { code: 'BR04', x: 1138, y: 405 },
  { code: 'BR05', x: 1282, y: 341 },
  { code: 'BR06', x: 1341, y: 344 },
  { code: 'BR07', x: 1385, y: 395 },
  { code: 'BR08', x: 1486, y: 365 },
  { code: 'RA01', x: 1788, y: 370 },
  { code: 'RA02', x: 1826, y: 385 },
  { code: 'RA03', x: 1858, y: 359 },
  { code: 'RA04', x: 1892, y: 327 },
  { code: 'RB01', x: 1926, y: 328 },
  { code: 'RB02', x: 1936, y: 371 },
  { code: 'RB03', x: 1957, y: 338 },
];

/** Seat anchors measured against public/virtual/4_virtual.png. */
const STUDY_SEAT_MARKERS: VirtualSeatMarker[] = [
  { code: 'UA01', x: 623, y: 466 },
  { code: 'UA02', x: 670, y: 397 },
  { code: 'UA03', x: 675, y: 364 },
  { code: 'UA04', x: 696, y: 344 },
  { code: 'UA05', x: 716, y: 334 },
  { code: 'UA06', x: 722, y: 305 },
  { code: 'UA07', x: 736, y: 324 },
  { code: 'UA08', x: 760, y: 305 },
  { code: 'UB01', x: 778, y: 325 },
  { code: 'UB02', x: 787, y: 346 },
  { code: 'LW01', x: 798, y: 371 },
  { code: 'LW02', x: 805, y: 306 },
  { code: 'LW03', x: 840, y: 397 },
  { code: 'LW04', x: 851, y: 305 },
  { code: 'RA01', x: 892, y: 304 },
  { code: 'RA02', x: 912, y: 304 },
  { code: 'RA03', x: 932, y: 305 },
  { code: 'RA04', x: 935, y: 481 },
  { code: 'RB01', x: 952, y: 314 },
  { code: 'RB02', x: 988, y: 313 },
  { code: 'RB03', x: 1051, y: 325 },
  { code: 'RB04', x: 1122, y: 326 },
  { code: 'RC01', x: 1231, y: 334 },
  { code: 'RC02', x: 1377, y: 341 },
  { code: 'RC03', x: 1505, y: 336 },
  { code: 'RC04', x: 1630, y: 346 },
  { code: 'RW01', x: 1704, y: 361 },
  { code: 'RW02', x: 1859, y: 389 },
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
