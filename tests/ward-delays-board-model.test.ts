import { describe, expect, it } from "vitest";

import { delayGroups } from "@/components/ward-management/delays/delays-derivations";
import {
  BOARD_OWNERS,
  NO_FILTERS,
  OVER_12H,
  OVER_24H,
  OVER_8H,
  SILENT_MINUTES,
  bandCounts,
  boardCatchments,
  boardRows,
  filterRows,
  isPinned,
  ownerTiles,
  projectedOver8,
  rowEvents,
  runwayBins,
  spreadX,
  waitBand,
  wardSummary,
} from "@/components/ward-management/delays/delays-board-model";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The Delays board model: pure derivations behind the October 2026 board. Every figure is read
 * from the engine, so these pin the arithmetic and the boundaries rather than any copy.
 */

const state = seedWardFlowState();
const UNITS = allUnits();
const OPEN = state.movements.filter(isOpen);
const ROWS = boardRows(delayGroups(state.movements, UNITS, NOW_ANCHOR), NOW_ANCHOR);
const nameOf = () => "";

describe("the Delays board model", () => {
  it("has one row per open person, and nobody twice", () => {
    expect(ROWS).toHaveLength(OPEN.length);
    expect(new Set(ROWS.map((row) => row.movement.id)).size).toBe(OPEN.length);
  });

  it("bands waits at exactly 8, 12 and 24 hours, each boundary in the higher band", () => {
    expect(waitBand(OVER_8H - 1)).toBe(0);
    expect(waitBand(OVER_8H)).toBe(1);
    expect(waitBand(OVER_12H - 1)).toBe(1);
    expect(waitBand(OVER_12H)).toBe(2);
    expect(waitBand(OVER_24H - 1)).toBe(2);
    expect(waitBand(OVER_24H)).toBe(3);
    expect(bandCounts(ROWS).reduce((sum, n) => sum + n, 0)).toBe(ROWS.length);
  });

  it("treats a person with nothing recorded since arrival as quiet for their whole wait", () => {
    const untouched = ROWS.filter((row) => row.activity === undefined);
    expect(untouched.length, "everyone has a recorded event, so this proves nothing").toBeGreaterThan(0);
    for (const row of untouched) expect(row.quiet).toBe(row.waited);
    for (const row of ROWS) expect(row.silent).toBe(row.quiet >= SILENT_MINUTES);
  });

  it("counts a ward's acceptance as a recorded update, so quiet time restarts from it", () => {
    const accepted = ROWS.find((row) => row.movement.acceptedUnitId !== undefined)!;
    expect(accepted, "nobody has an accepted bed in this fixture").toBeDefined();
    const movement = { ...accepted.movement, acceptedAt: NOW_ANCHOR - 5 };
    const groups = delayGroups([movement], UNITS, NOW_ANCHOR);
    const [row] = boardRows(groups, NOW_ANCHOR);
    expect(row.activity?.what).toBe("a ward accepted");
    expect(row.quiet).toBe(5);
    expect(row.silent).toBe(false);
  });

  it("draws a tile only for owners a cause can map to, and the tiles partition everyone", () => {
    expect(BOARD_OWNERS.map((owner) => owner.id)).not.toContain("ed");
    const tiles = ownerTiles(ROWS);
    expect(tiles.reduce((sum, tile) => sum + tile.rows.length, 0)).toBe(ROWS.length);
  });

  it("always lists the four primary catchments, and any other only when somebody is in it", () => {
    const origins = boardCatchments(ROWS);
    expect(origins.slice(0, 4)).toEqual(["North Metro", "East Metro", "South Metro", "WACHS"]);
    for (const origin of origins.slice(4)) {
      expect(
        ROWS.some((row) => row.origin === origin),
        `${origin} is listed with nobody in it`,
      ).toBe(true);
    }
  });

  it("puts each crossing in exactly one half hour, and only for people below the line now", () => {
    const bins = runwayBins(ROWS);
    expect(bins).toHaveLength(8);
    for (const row of ROWS) {
      const hits = bins.filter((bin) => bin.cross8.includes(row));
      if (row.waited < OVER_8H && row.waited + 240 >= OVER_8H) expect(hits, row.movement.id).toHaveLength(1);
      else expect(hits, row.movement.id).toHaveLength(0);
    }
    const projection = projectedOver8(ROWS, bins);
    expect(projection[0]).toBe(ROWS.filter((row) => row.waited >= OVER_8H).length);
    expect(projection.at(-1)).toBe(projection[0] + bins.reduce((sum, bin) => sum + bin.cross8.length, 0));
  });

  it("counts a recorded legal time in the half hour it falls due, never a passed one", () => {
    const bins = runwayBins(ROWS);
    for (const bin of bins) {
      for (const row of bin.formDue) {
        expect(row.dueIn).toBeGreaterThan(bin.from);
        expect(row.dueIn).toBeLessThanOrEqual(bin.to);
      }
    }
  });

  it("filters combine, and no filter shows everyone", () => {
    const bins = runwayBins(ROWS);
    expect(filterRows(ROWS, NO_FILTERS, bins, nameOf)).toHaveLength(ROWS.length);
    const lockedYours = filterRows(ROWS, { ...NO_FILTERS, owner: "yours", locked: true }, bins, nameOf);
    expect(lockedYours.every((row) => row.owner === "yours" && row.locked)).toBe(true);
    expect(lockedYours).toHaveLength(ROWS.filter((row) => row.owner === "yours" && row.locked).length);
    const over24 = filterRows(ROWS, { ...NO_FILTERS, threshold: 3 }, bins, nameOf);
    expect(over24.every((row) => row.waited >= OVER_24H)).toBe(true);
  });

  it("summarises the wards from the record: accepted, declined or asked", () => {
    for (const row of ROWS) {
      const summary = wardSummary(row, UNITS);
      if (row.movement.acceptedUnitId !== undefined)
        expect(summary.tone === "success" || summary.tone === "warning").toBe(true);
      else if (row.movement.declines.length > 0)
        expect(summary.text).toMatch(new RegExp(`^${row.movement.declines.length} declined`, "u"));
      else if (row.movement.referredUnitIds.length === 0) expect(summary.text).toBe("No ward asked yet");
    }
  });

  it("starts every timeline at arrival and never shows an event after now", () => {
    for (const row of ROWS) {
      const events = rowEvents(row, UNITS, NOW_ANCHOR);
      expect(events[0].offset).toBe(0);
      expect(events[0].what).toMatch(/^Arrived, /u);
      for (const event of events) expect(event.offset).toBeLessThanOrEqual(row.waited);
      const offsets = events.map((event) => event.offset);
      expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
    }
  });

  it("pins only recorded legal times within the soon warning", () => {
    for (const row of ROWS) expect(isPinned(row)).toBe(row.dueIn !== undefined && row.dueIn <= 180);
  });

  it("scales the spread linearly to 24 hours, then compresses up to 7 days", () => {
    expect(spreadX(0)).toBe(0);
    expect(spreadX(OVER_8H)).toBeCloseTo((86 * 8) / 24);
    expect(spreadX(OVER_24H)).toBe(86);
    expect(spreadX(7 * OVER_24H)).toBeCloseTo(98);
    expect(spreadX(30 * OVER_24H)).toBeCloseTo(98);
    expect(spreadX(2 * OVER_24H)).toBeGreaterThan(86);
  });
});
