// M121 (master audit list, 10 Nov 2026): statistics definitions and arithmetic. Hand-worked figures
// for the shared helpers named in docs/ward-flow/statistics-definitions.md, and a ratchet that
// fails when a new inline percentage (`* 100`) appears in the app source. Synthetic values only.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import baseline from "./ward-audit-m121-inline-percent-baseline.json";
import {
  NO_BEDS_TEXT,
  occupancyPercent,
  occupancyText,
} from "../src/components/ward-management/statistics/statistics-occupancy";
import { journeyStages } from "../src/components/ward-management/statistics/statistics-journey-view";
import { bedStates } from "../src/components/ward-management/ward-bed-states";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { median } from "../src/components/ward-management/statistics/executive-statistics-derivations";
import { CLEARANCE_MEDIAN_MIN_JOURNEYS, clearanceMedian } from "../src/components/ward-management/ed/ed-clearance-time";
import { edPresentationsInWindow } from "../src/components/ward-management/ward-patient-care-plans";

describe("M121 hand-worked figures", () => {
  it("occupancy is (occupied + pulled) over beds, rounded to a whole percent", () => {
    // 15 occupied + 2 pulled of 20 beds = 17 / 20 = 85%.
    expect(occupancyPercent({ beds: 20, inUse: 15 + 2 })).toBe(85);
    // 1 of 3 = 33.33...% rounds to 33; 2 of 3 = 66.66...% rounds to 67.
    expect(occupancyPercent({ beds: 3, inUse: 1 })).toBe(33);
    expect(occupancyPercent({ beds: 3, inUse: 2 })).toBe(67);
    // A full ward and an over-full ward (a pulled bed on top of a full ward) are not capped.
    expect(occupancyPercent({ beds: 10, inUse: 10 })).toBe(100);
    expect(occupancyPercent({ beds: 10, inUse: 11 })).toBe(110);
  });

  it("the shared median is the middle value, or the mean of the two middle values", () => {
    expect(median([])).toBeNull();
    expect(median([42])).toBe(42);
    // Sorted 1, 3, 7, 9: (3 + 7) / 2 = 5.
    expect(median([9, 1, 7, 3])).toBe(5);
    // Sorted 2, 4, 30: the middle is 4, however long the tail.
    expect(median([30, 2, 4])).toBe(4);
  });

  it("median time to clearance says too few under five journeys, then uses the same middle rule", () => {
    expect(CLEARANCE_MEDIAN_MIN_JOURNEYS).toBe(5);
    expect(clearanceMedian([60, 120, 30, 90])).toEqual({ count: 4, medianMinutes: null });
    // Sorted 30, 60, 90, 120, 600: the middle is 90 minutes.
    expect(clearanceMedian([600, 30, 120, 60, 90])).toEqual({ count: 5, medianMinutes: 90 });
    // Six: (90 + 120) / 2 = 105 minutes.
    expect(clearanceMedian([600, 30, 120, 60, 90, 240])).toEqual({ count: 6, medianMinutes: 105 });
    // The two medians agree wherever both give a figure.
    expect(clearanceMedian([600, 30, 120, 60, 90, 240]).medianMinutes).toBe(median([600, 30, 120, 60, 90, 240]));
  });

  it("frequent presenter counts ED presentations in the twelve months up to and including today", () => {
    const episodes = [
      { kind: "ed", start: "10 Nov 2025" }, // exactly a year ago: outside (the window opens after it)
      { kind: "ed", start: "11 Nov 2025" }, // inside
      { kind: "ed", start: "10 Nov 2026" }, // today: inside
      { kind: "ed", start: "11 Nov 2026" }, // tomorrow: outside
      { kind: "ed", start: "Mar 2026" }, // month only: not counted
      { kind: "inpatient", start: "1 Jun 2026" }, // not an ED presentation
    ];
    expect(edPresentationsInWindow(episodes, "2026-11-10")).toBe(2);
  });

  it("the shared occupancy helper returns 0 for a ward with no beds (callers must show no beds)", () => {
    // Pinned: the helper's own contract. Screens print occupancyText, which says "No beds" (below).
    expect(occupancyPercent({ beds: 0, inUse: 0 })).toBe(0);
  });
  // Fixed (Josh approved, D-125, 10 Nov 2026).
  it("M121 fixed: a ward with no beds prints 'No beds', never 0%", () => {
    expect(NO_BEDS_TEXT).toBe("No beds");
    expect(occupancyText({ beds: 0, inUse: 0 })).toBe("No beds");
    expect(occupancyText({ beds: 20, inUse: 17 })).toBe("85%");
    expect(occupancyText({ beds: 3, inUse: 0 })).toBe("0%");
    const src = (file: string) => readFileSync(path.join(__dirname, "..", file), "utf8");
    const dir = "src/components/ward-management/";
    expect(src(`${dir}statistics/hospital-capacity-matrix.tsx`)).toContain("occupancyText({ beds: r.beds");
    expect(src(`${dir}statistics/hospital-capacity-matrix.tsx`)).not.toContain("{r.occRate}%");
    expect(src(`${dir}tools/ward-tool-messages.tsx`)).toContain("`Occupancy: ${NO_BEDS_TEXT}.`");
    expect(src(`${dir}tools/ward-tool-messages.tsx`)).not.toMatch(/`Occupancy: \$\{(?:f\.)?occupancy\}%/);
    expect(src(`${dir}statistics/statistics-ward-top.tsx`)).toContain("unit.beds > 0 ? `in use, ${occupancyPct}%`");
    expect(src(`${dir}statistics/statistics-service-screen.tsx`)).toContain(
      "totalBedBase > 0 ? `${occupancyPct}%` : NO_BEDS_TEXT",
    );
  });

  it("M121 fixed: 'In use' is beds in use (occupied + pulled) over beds, like every other occupancy", () => {
    const seed = seedWardFlowState();
    const { units, admissions, bedReleases, leaveBeds, movements } = seed;
    const totals = units.reduce(
      (sum, unit) => {
        const states = bedStates(unit, admissions, [...bedReleases], leaveBeds, []);
        return {
          beds: sum.beds + unit.beds,
          occupied: sum.occupied + states.occupied,
          inUse: sum.inUse + states.occupied + states.pulled,
        };
      },
      { beds: 0, occupied: 0, inUse: 0 },
    );
    // The seed has a pulled bed, so the two rules give different answers and the test can tell.
    expect(totals.inUse).toBeGreaterThan(totals.occupied);
    const ward = journeyStages({ units, admissions, bedReleases, leaveBeds, movements, now: NOW_ANCHOR }).find(
      (stage) => stage.id === "ward",
    );
    expect(ward?.breakdown.find((part) => part.label === "In use")?.value).toBe(
      `${Math.round((totals.inUse / totals.beds) * 100)}%`,
    );
    expect(
      journeyStages({ units: [], admissions, bedReleases, leaveBeds, movements, now: NOW_ANCHOR })
        .find((stage) => stage.id === "ward")
        ?.breakdown.find((part) => part.label === "In use")?.value,
    ).toBe("No beds");
    const dir = path.join(__dirname, "..", "src/components/ward-management/statistics");
    const exec = readFileSync(path.join(dir, "executive-statistics-derivations.ts"), "utf8");
    expect(exec).toContain("text: occupancyText({ beds: beds.total, inUse: beds.inUse }),");
    expect(exec).not.toMatch(/beds\.occupied \/ beds\.total/);
    const map = readFileSync(path.join(dir, "statistics-map-view.tsx"), "utf8");
    expect(map).not.toMatch(/\* 100/);
    expect(map).not.toMatch(/\$\{(?:site|network|row|ward)\.pct\}%|\{ward\.pct\}%/);
  });
});

describe("M121 inline percentage ratchet", () => {
  const root = path.resolve(__dirname, "..");
  const counts = new Map<string, number>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const relative = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(relative);
      else if (/\.tsx?$/.test(entry.name)) {
        const found = readFileSync(path.join(root, relative), "utf8").match(/\*\s*100\b(?!\d)/g)?.length ?? 0;
        if (found) counts.set(relative, found);
      }
    }
  };
  walk("src");
  const allowed = baseline as Record<string, number>;

  it("no file gains a new inline `* 100`: use occupancyPercent or a named shared helper instead", () => {
    const grown = [...counts]
      .filter(([file, count]) => count > (allowed[file] ?? 0))
      .map(([file, count]) => `${file}: ${count} (allowed ${allowed[file] ?? 0})`);
    expect(grown, "new inline percentages; route them through a shared, tested helper").toEqual([]);
  });
});
