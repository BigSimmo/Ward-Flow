import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { travelBand } from "@/components/ward-management/ward-distance";
import { HOME_REGIONS } from "@/components/ward-management/ward-model";
import { wardSites } from "@/components/ward-management/ward-sites";
import {
  CHECKED_TRAVEL_BANDS,
  SHOWN_TRAVEL_BANDS,
  TRAVEL_BANDS,
  travelBandTable,
} from "@/components/ward-management/ward-travel-bands";

/**
 * A16-04 (root cause R7; Josh approved 13 Nov 2026). The app shows only travel bands someone has
 * checked, each saying who checked it and when, and every other pair reads as not recorded. The
 * old table was filled in by list position and told a man in Murdoch that Fiona Stanley was three
 * hours away; a test needed that pair to stay wrong.
 *
 * This file must NOT import `tests/helpers/ward-test-travel-bands.ts`: it guards the table the app
 * really shows, and that helper swaps in the tests' own invented one.
 */

const SITE_CODES = wardSites.map((site) => site.code);
const SRC_ROOT = join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

describe("A16-04: only checked travel bands reach a screen", () => {
  it("builds the shown table from the checked list and nothing else", () => {
    expect(SHOWN_TRAVEL_BANDS).toEqual(travelBandTable(CHECKED_TRAVEL_BANDS));
  });

  it("reads every pair nobody has checked as not recorded", () => {
    for (const region of HOME_REGIONS) {
      for (const siteCode of SITE_CODES) {
        const checked = CHECKED_TRAVEL_BANDS.find(
          (entry) => entry.homeRegion === region && entry.siteCode === siteCode,
        );
        expect(travelBand(region, siteCode), `${region} to ${siteCode}`).toBe(checked?.band);
      }
    }
  });

  it("no longer shows the list-position band from Perth to Fiona Stanley unless someone checked it", () => {
    // The pair on Cyril's Place tab (Act 3) that read "Three hours or more from home".
    const checked = CHECKED_TRAVEL_BANDS.find(
      (entry) => entry.homeRegion === "Perth Metropolitan" && entry.siteCode === "FSH",
    );
    expect(travelBand("Perth Metropolitan", "FSH")).toBe(checked?.band);
  });

  it("gives every checked band a real pair, a band, who checked it and the day", () => {
    const seen = new Set<string>();
    for (const entry of CHECKED_TRAVEL_BANDS) {
      const pair = `${entry.homeRegion} to ${entry.siteCode}`;
      expect(HOME_REGIONS, pair).toContain(entry.homeRegion);
      expect(SITE_CODES, pair).toContain(entry.siteCode);
      expect(TRAVEL_BANDS, pair).toContain(entry.band);
      expect(entry.checkedBy.trim().length, `${pair} must say who checked it`).toBeGreaterThan(0);
      expect(entry.checkedOn, `${pair} must say the day it was checked`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(entry.checkedOn)), `${pair} has a checkedOn that is not a date`).toBe(false);
      expect(seen.has(pair), `${pair} is checked twice`).toBe(false);
      seen.add(pair);
    }
  });

  it("does not fill the shown table from the metropolitan road distances or the tests' table", () => {
    // The reference distances measure hospital to hospital in Perth, not how far a person lives from
    // a hospital. Filling bands from them would be a real-looking value that measured something else.
    const bandsSource = readFileSync(join(SRC_ROOT, "components", "ward-management", "ward-travel-bands.ts"), "utf8");
    expect(bandsSource).not.toMatch(/from\s+["'][^"']*reference/);
    expect(bandsSource).not.toMatch(/from\s+["'][^"']*ward-test-travel-bands/);
    for (const file of sourceFiles(SRC_ROOT)) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/from\s+["'][^"']*ward-test-travel-bands/);
    }
  });

  it("keeps the old invented table name out of the app", () => {
    for (const file of sourceFiles(SRC_ROOT)) {
      const code = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      expect(code, file).not.toMatch(/SYNTHETIC_TRAVEL_BANDS|TRAVEL_BANDS_ARE_INVENTED/);
    }
  });
});
