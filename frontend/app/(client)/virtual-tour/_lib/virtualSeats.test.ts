import { describe, expect, it } from "vitest";

import { allSeatIds } from "@/lib/seats";

import { PANORAMA_IMAGES } from "./tourGraph";
import {
  VIRTUAL_PANORAMA_HEIGHT,
  VIRTUAL_PANORAMA_WIDTH,
  VIRTUAL_SEAT_MARKERS,
  VIRTUAL_SEAT_MARKERS_BY_PANORAMA,
} from "./virtualSeats";

describe("virtual-tour seat markers", () => {
  it("only references seats from the shared facility catalogue", () => {
    const knownSeats = new Set(allSeatIds);

    expect(VIRTUAL_SEAT_MARKERS.length).toBeGreaterThan(0);
    expect(VIRTUAL_SEAT_MARKERS.every(({ code }) => knownSeats.has(code))).toBe(true);
  });

  it("keeps every marker inside the panorama image bounds", () => {
    for (const marker of VIRTUAL_SEAT_MARKERS) {
      expect(marker.x, `${marker.code} x coordinate`).toBeGreaterThanOrEqual(0);
      expect(marker.x, `${marker.code} x coordinate`).toBeLessThanOrEqual(VIRTUAL_PANORAMA_WIDTH);
      expect(marker.y, `${marker.code} y coordinate`).toBeGreaterThanOrEqual(0);
      expect(marker.y, `${marker.code} y coordinate`).toBeLessThanOrEqual(VIRTUAL_PANORAMA_HEIGHT);
    }
  });

  it("has no duplicate seat within one panorama", () => {
    for (const [panorama, markers] of Object.entries(VIRTUAL_SEAT_MARKERS_BY_PANORAMA)) {
      const codes = markers?.map(({ code }) => code) ?? [];
      expect(new Set(codes).size, `${panorama} marker count`).toBe(codes.length);
    }
  });

  it("maps marker groups to configured panorama images", () => {
    expect(Object.keys(VIRTUAL_SEAT_MARKERS_BY_PANORAMA).sort()).toEqual(
      Object.keys(PANORAMA_IMAGES).sort(),
    );
  });
});
