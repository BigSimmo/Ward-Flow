/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { ED_WAIT_BANDS, edWaitBands } from "@/components/ward-management/statistics/statistics-ed-waits";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * 🔴 **THE FIVE WAIT BANDS, AND THE PROPERTY THAT MATTERS MOST IS THAT AN EMPTY BAND STILL EXISTS.**
 *
 * The approved drawing is explicit, and its reasoning is the whole design:
 *
 * > *"They are still drawn, and each reads none, which is a measured answer and not a missing
 * > figure."*
 * > *"a band that vanishes when it is empty is a band a reader cannot trust when it is not."*
 *
 * ⚠️ **A TABLE THAT DROPS ITS EMPTY ROWS TEACHES A READER THAT EVERY ROW SHOWN IS A ROW THAT
 * MATTERS** — so when the twelve-to-twenty-four hour band finally appears, they cannot tell whether
 * it just filled or has been there all along. 🔴 **The bands are therefore a FIXED list, and every
 * one of them is returned on every call, including on an empty department.**
 *
 * ✅ **Boundaries are constructed, never sampled.** Each band's edges are pinned from both sides, so
 * a `>=` silently becoming a `>` reddens. **None of these instants is reachable from the seed.**
 */

const SEED = seedWardFlowState();
const TEMPLATE = SEED.movements[0];
const NOW = 100_000;
const HERE = "ed-under-test";
const HOUR = 60;

function specimen(changes: Partial<Movement>): Movement {
  expect(TEMPLATE, "the seed holds no movements, so every case here would assert nothing").toBeDefined();
  return {
    ...structuredClone(TEMPLATE!),
    originEdId: HERE,
    openedAt: NOW - HOUR,
    acceptedUnitId: undefined,
    closure: undefined,
    stage: "placement_requested",
    declines: [],
    ...changes,
  };
}

/**
 * A movement whose wait is exactly `minutes`. ⚠️ `Movement["id"]`, not `string` — the model types
 * it as a template literal, and a plain `string` parameter here typechecked at the call sites while
 * failing at the return. **No `as` cast: the type is named rather than silenced.**
 */
function waiting(id: Movement["id"], minutes: number): Movement {
  return specimen({ id, openedAt: NOW - minutes });
}

describe("the five wait bands", () => {
  /**
   * 🔴 **THE ANTI-DISAPPEARING-ROW PROPERTY.** Asserted on a department with NOBODY in it, because
   * that is the case where a filtering implementation looks correct.
   */
  it("returns all five bands on a department with nobody waiting, each reading nought", () => {
    const bands = edWaitBands([], HERE, NOW);

    expect(bands, "a band vanished when it was empty").toHaveLength(ED_WAIT_BANDS.length);
    expect(bands.map((band) => band.label)).toEqual([...ED_WAIT_BANDS.map((band) => band.label)]);
    expect(bands.every((band) => band.count === 0)).toBe(true);
  });

  /**
   * ⚠️ **THE BANDS MUST PARTITION.** Unlike `over24h`/`over48h` — which deliberately OVERLAP and must
   * never be summed — these five are a true partition of everyone waiting. 🔴 **Two figure sets with
   * opposite arithmetic live in one module, so the difference is pinned rather than left to a
   * reader.**
   */
  it("puts every waiting movement in exactly one band", () => {
    const movements = [
      waiting("WF-1", 30),
      waiting("WF-2", 5 * HOUR),
      waiting("WF-3", 9 * HOUR),
      waiting("WF-4", 20 * HOUR),
      waiting("WF-5", 30 * HOUR),
      waiting("WF-6", 200 * HOUR),
    ];
    const bands = edWaitBands(movements, HERE, NOW);

    expect(
      bands.reduce((total, band) => total + band.count, 0),
      "the bands do not partition the waiting list",
    ).toBe(movements.length);
    expect(bands.map((band) => band.count)).toEqual([1, 1, 1, 1, 2]);
  });

  /**
   * 🔴 **EVERY EDGE, FROM BOTH SIDES.** One minute under and exactly on, for all four internal
   * boundaries. ⚠️ **A single sampled value either side of a boundary cannot tell `>=` from `>`.**
   */
  it.each([
    { minutes: 4 * HOUR - 1, band: "Under 4 hours" },
    { minutes: 4 * HOUR, band: "4 to 8 hours" },
    { minutes: 8 * HOUR - 1, band: "4 to 8 hours" },
    { minutes: 8 * HOUR, band: "8 to 12 hours" },
    { minutes: 12 * HOUR - 1, band: "8 to 12 hours" },
    { minutes: 12 * HOUR, band: "12 to 24 hours" },
    { minutes: MINUTES_PER_DAY - 1, band: "12 to 24 hours" },
    { minutes: MINUTES_PER_DAY, band: "Over 24 hours" },
  ])("places a $minutes-minute wait in $band", ({ minutes, band }) => {
    const bands = edWaitBands([waiting("WF-edge", minutes)], HERE, NOW);
    const occupied = bands.filter((entry) => entry.count > 0);

    expect(
      occupied.map((entry) => entry.label),
      `a ${minutes}-minute wait landed in the wrong band`,
    ).toEqual([band]);
  });

  /**
   * ⚠️ **A movement opened after now is clamped to a nought wait, so it belongs in the first band —
   * not outside the bands entirely.** 🔴 **A partition that silently loses a member is worse than one
   * that puts it in the wrong place, because the total still looks plausible.**
   */
  it("keeps a future-dated movement inside the partition rather than dropping it", () => {
    const bands = edWaitBands([specimen({ id: "WF-future", openedAt: NOW + 500 })], HERE, NOW);

    expect(bands.reduce((total, band) => total + band.count, 0)).toBe(1);
    expect(bands[0]?.count).toBe(1);
  });

  it("counts only this department, and only its open movements", () => {
    const bands = edWaitBands(
      [
        waiting("WF-mine", 30),
        specimen({ id: "WF-elsewhere", originEdId: "ed-other", openedAt: NOW - 30 }),
        specimen({ id: "WF-arrived", openedAt: NOW - 30, stage: "arrived" as Movement["stage"] }),
      ],
      HERE,
      NOW,
    );

    expect(bands.reduce((total, band) => total + band.count, 0)).toBe(1);
  });
});
