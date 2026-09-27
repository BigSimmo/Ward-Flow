// tests/ward-movements-corridors.test.ts
//
// `corridorCounts` (movements-derivations.ts) answers "how many patients are currently moving
// down each origin-ED-to-accepted-unit corridor, and at which stage" — a later task renders
// exactly this shape. Every movement here is hand-built, never cloned from `wardMovements`: the
// seed fixture is due to be replaced wholesale, and a test that only holds for today's seed would
// prove nothing about the derivation itself. The expected answer for every case below is meant to
// be obvious from the movement literals alone, with no fixture to cross-reference.
import { describe, expect, it } from "vitest";

import {
  corridorCounts,
  refusedCorridorCounts,
  type CorridorCount,
} from "@/components/ward-management/movements/movements-derivations";
import type { Movement, MovementId } from "@/components/ward-management/ward-model";

/**
 * Every field `Movement` requires, filled with an innocuous constant value that no test below
 * depends on — only `originEdId`, `acceptedUnitId`, `stage` and `closure` (the fields
 * `corridorCounts` actually reads, directly or via `isOpen`) vary per case. Deliberately NOT built
 * from `wardMovements`: see the file banner above.
 */
function buildMovement(id: MovementId, patch: Partial<Movement> = {}): Movement {
  return {
    id,
    originEdId: "ED-TEST",
    openedAt: 0,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    specialling: false,
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "placement_requested",
    owner: "Test Coordinator",
    referredUnitIds: [],
    declines: [],
    blocker: "No blocker",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    ...patch,
  };
}

/** Order-independent comparison — `corridorCounts` makes no promise about row order, only about
 *  which rows exist and what each one counts. */
function sorted(rows: CorridorCount[]): CorridorCount[] {
  return [...rows].sort((a, b) =>
    `${a.originEdId} ${a.acceptedUnitId} ${a.stage}`.localeCompare(`${b.originEdId} ${b.acceptedUnitId} ${b.stage}`),
  );
}

describe("corridorCounts", () => {
  it("returns [] for an empty input", () => {
    expect(corridorCounts([])).toEqual([]);
  });

  it("collapses two movements down one corridor at one stage into a single row of 2", () => {
    const a = buildMovement("WF-TEST-01", { originEdId: "ED-A", acceptedUnitId: "WARD-1", stage: "moving" });
    const b = buildMovement("WF-TEST-02", { originEdId: "ED-A", acceptedUnitId: "WARD-1", stage: "moving" });

    expect(corridorCounts([a, b])).toEqual([
      { originEdId: "ED-A", acceptedUnitId: "WARD-1", stage: "moving", count: 2 },
    ]);
  });

  it("keeps two different origins sharing one destination as two separate rows, not one merged row of 2", () => {
    const a = buildMovement("WF-TEST-01", { originEdId: "ED-A", acceptedUnitId: "WARD-1", stage: "moving" });
    const b = buildMovement("WF-TEST-02", { originEdId: "ED-B", acceptedUnitId: "WARD-1", stage: "moving" });

    expect(sorted(corridorCounts([a, b]))).toEqual([
      { originEdId: "ED-A", acceptedUnitId: "WARD-1", stage: "moving", count: 1 },
      { originEdId: "ED-B", acceptedUnitId: "WARD-1", stage: "moving", count: 1 },
    ]);
  });

  it("keeps the same corridor at two different stages as two separate rows", () => {
    const a = buildMovement("WF-TEST-01", { originEdId: "ED-A", acceptedUnitId: "WARD-1", stage: "pulled" });
    const b = buildMovement("WF-TEST-02", { originEdId: "ED-A", acceptedUnitId: "WARD-1", stage: "moving" });

    expect(sorted(corridorCounts([a, b]))).toEqual([
      { originEdId: "ED-A", acceptedUnitId: "WARD-1", stage: "moving", count: 1 },
      { originEdId: "ED-A", acceptedUnitId: "WARD-1", stage: "pulled", count: 1 },
    ]);
  });

  it("excludes a movement with no acceptedUnitId entirely — no corridor exists yet, so no row, not a row of zero", () => {
    const stillAwaitingAcceptance = buildMovement("WF-TEST-01", {
      originEdId: "ED-A",
      acceptedUnitId: undefined,
      stage: "destination_review",
    });
    expect(corridorCounts([stillAwaitingAcceptance])).toEqual([]);
  });

  it("excludes an arrived movement (isOpen is false) from the count of its former corridor", () => {
    const arrived = buildMovement("WF-TEST-01", {
      originEdId: "ED-A",
      acceptedUnitId: "WARD-1",
      stage: "arrived",
    });
    expect(corridorCounts([arrived])).toEqual([]);
  });

  it("excludes a closed (did-not-proceed) movement even though it still names an accepted unit and a live-looking stage", () => {
    const abandoned = buildMovement("WF-TEST-01", {
      originEdId: "ED-A",
      acceptedUnitId: "WARD-1",
      stage: "pulled",
      closure: { at: 0, outcome: "did_not_proceed", reason: "Test scaffolding — patient declined transfer." },
    });
    expect(corridorCounts([abandoned])).toEqual([]);
  });

  it("never produces a row for a corridor/stage combination with zero open movements in it", () => {
    const a = buildMovement("WF-TEST-01", { originEdId: "ED-A", acceptedUnitId: "WARD-1", stage: "moving" });
    const rows = corridorCounts([a]);
    expect(rows.find((row) => row.stage === "handover_ready")).toBeUndefined();
    expect(rows).toHaveLength(1);
  });
});

describe("refusedCorridorCounts", () => {
  it("counts recorded declines up to now today and excludes a future same-day record", () => {
    const movement = buildMovement("WF-TEST-01", {
      originEdId: "ED-A",
      declines: [
        { unitId: "WARD-1", at: 90, reason: "no_bed" },
        { unitId: "WARD-1", at: 110, reason: "acuity_mix" },
      ],
    });

    expect(refusedCorridorCounts([movement], 100)).toEqual([
      { originEdId: "ED-A", unitId: "WARD-1", count: 1, reasons: ["no_bed"] },
    ]);
  });
});
