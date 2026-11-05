import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  IN_USE_CAPTION,
  IN_USE_NOUN,
  OCCUPIED_CAPTION,
  OCCUPIED_NOUN,
  ON_THE_WARD_NOUN,
  wardBedsInUse,
} from "@/components/ward-management/ward-occupancy";
import { DEMONSTRATION_DAY_LABEL } from "@/components/ward-management/ward-sites";

/**
 * WF-16 follow-up: paired figures either share one source or are labelled so
 * a reader can tell them apart (discharges due vs forecast; ready vs spare that
 * fit; Occupied vs In use).
 */
describe("WF-16 figure labels", () => {
  it("exports Occupied / In use nouns that match the one occupancy math", () => {
    expect(OCCUPIED_NOUN).toBe("Occupied");
    expect(ON_THE_WARD_NOUN).toBe("On the ward");
    expect(IN_USE_NOUN).toBe("In use");
    expect(OCCUPIED_CAPTION.toLowerCase()).toMatch(/leave/);
    expect(IN_USE_CAPTION.toLowerCase()).toMatch(/pulled/);
    expect(typeof wardBedsInUse).toBe("function");
  });

  it("Capacity hero names beds freeing today, not a forecast discharge total", () => {
    const hero = readFileSync("src/components/ward-management/capacity/capacity-hero.tsx", "utf8");
    expect(hero).toMatch(/label="Beds freeing today"/);
    expect(hero).not.toMatch(/label="Discharges due today"/);
    const forecast = readFileSync("src/components/ward-management/capacity/capacity-bed-forecast.tsx", "utf8");
    expect(forecast).toMatch(/Beds freeing today/);
    expect(forecast).toMatch(/next 24/);
  });

  it("Mismatch band labels spare as ready-that-fit, not all ready beds", () => {
    const band = readFileSync("src/components/ward-management/capacity/capacity-mismatch-band.tsx", "utf8");
    expect(band).toMatch(/Spare that fit/);
    expect(band).toMatch(/ready that fit/);
  });

  it("Prototype footer names the demo board clock and scenario day", () => {
    const footer = readFileSync("src/components/ward-management/shell/ward-prototype-footer.tsx", "utf8");
    expect(footer).toMatch(/Demo board clock/);
    expect(footer).toMatch(/scenario set on \$\{DEMONSTRATION_DAY_LABEL\}/);
    expect(DEMONSTRATION_DAY_LABEL.length).toBeGreaterThan(0);
  });
});

it("Capacity hero names locked/open ready as beds (not wards)", () => {
  const hero = readFileSync("src/components/ward-management/capacity/capacity-hero.tsx", "utf8");
  expect(hero).toMatch(/label="Locked ready beds"/);
  expect(hero).toMatch(/label="Open ready beds"/);
});

it("Statistics map occupancy percent uses the In use noun", () => {
  const map = readFileSync("src/components/ward-management/statistics/statistics-map-view.tsx", "utf8");
  expect(map).toMatch(/label: IN_USE_NOUN/);
  expect(map).not.toMatch(/label: "Occupied"/);
});
