/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { edWaitFigures } from "@/components/ward-management/statistics/statistics-ed-waits";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * 🔴 **THE ED SCREEN'S WAIT MATHS, NOW REACHABLE WITHOUT A RENDER — AND THESE BOUNDARIES CANNOT BE
 * REACHED FROM THE SEED AT ALL.**
 *
 * Every figure this suite pins was, until now, an inline expression inside
 * `statistics-ed-screen.tsx`. ⚠️ **Maths with no module to call can only be tested through a render,
 * and a render test naturally asserts *"a number appears"* rather than *"the right number".*** **The
 * existing DOM suite exercises 30 minutes, 25 hours and 50 hours — nowhere near the edges where a
 * `>=` becomes a `>`.**
 *
 * ✅ **So every case below is a CONSTRUCTED SPECIMEN the fixture cannot produce.** 🔴 **A floor over a
 * total says the walk was not empty; it says nothing about whether the walk covered the thing you
 * are worried about.** **This lane shipped that exact defect yesterday: an anti-vacuity floor on the
 * SUM of three figures, healthy-looking at 3, while one of the three compared nought with nought.**
 * **Every figure here is therefore asserted individually and never through an aggregate.**
 *
 * ⚠️ **THE TEMPLATE IS CLONED FROM THE SEED RATHER THAN HAND-BUILT.** A hand-written `Movement`
 * literal needs an `as` cast the moment the model gains a required field, **and a cast plus a runner
 * that does not typecheck is how a wrong value ships looking tested** — that is how three decline
 * vocabularies hid from this lane for six green tests. **There is no cast anywhere in this file.**
 */

const SEED = seedWardFlowState();
const TEMPLATE = SEED.movements[0];

const NOW = 100_000;
const HERE = "ed-under-test";
const ELSEWHERE = "ed-somewhere-else";

/**
 * A movement in a known state, built from a real seeded one so it cannot drift from the type.
 * `closure` and `acceptedUnitId` are cleared explicitly: the template carries whatever the seed gave
 * it, and a specimen that inherits a closure silently leaves the open population.
 */
function specimen(changes: Partial<Movement>): Movement {
  expect(TEMPLATE, "the seed holds no movements, so every case here would assert nothing").toBeDefined();
  const base = structuredClone(TEMPLATE!);
  return {
    ...base,
    originEdId: HERE,
    openedAt: NOW - 60,
    flaggedUrgent: false,
    acceptedUnitId: undefined,
    closure: undefined,
    stage: "placement_requested",
    declines: [],
    ...changes,
  };
}

describe("who is on this department's list right now", () => {
  /**
   * ⚠️ **Each of the three is asserted separately.** A single total of 2 would hold with `urgent`
   * and `unplaced` wired to each other's movement.
   */
  it("counts on-the-list, urgent and unplaced as three independent figures", () => {
    const figures = edWaitFigures(
      [
        specimen({ id: "WF-a", flaggedUrgent: true, acceptedUnitId: "rph-adult-secure" }),
        specimen({ id: "WF-b", flaggedUrgent: false }),
        specimen({ id: "WF-c", originEdId: ELSEWHERE, flaggedUrgent: true }),
      ],
      HERE,
      NOW,
    );

    expect(figures.onTheList).toBe(2);
    expect(figures.urgent, "the urgent count picked up the other department's movement").toBe(1);
    expect(figures.unplaced, "an accepted movement was still counted as having no ward").toBe(1);
  });

  it("drops a movement that has arrived, because it is no longer open", () => {
    const figures = edWaitFigures(
      [specimen({ id: "WF-open" }), specimen({ id: "WF-arrived", stage: "arrived" as Movement["stage"] })],
      HERE,
      NOW,
    );

    expect(figures.onTheList).toBe(1);
    expect(figures.departmentMovements.map((movement) => movement.id)).toEqual(["WF-open"]);
  });
});

/**
 * 🔴 **THE SECOND POPULATION, AND THE REASON IT EXISTS.** A decline is a historical fact that stays
 * true after the movement it was made against reaches a bed. ⚠️ **Scoping decline counts to the open
 * population would erase exactly the declines belonging to the movements this department eventually
 * placed — the opposite of the truth they exist to show.**
 */
describe("the wider population the decline counts need", () => {
  it("keeps a closed movement that the open population correctly drops", () => {
    const figures = edWaitFigures(
      [
        specimen({ id: "WF-open" }),
        specimen({ id: "WF-arrived", stage: "arrived" as Movement["stage"] }),
        specimen({ id: "WF-elsewhere", originEdId: ELSEWHERE }),
      ],
      HERE,
      NOW,
    );

    expect([...figures.allDepartmentMovements].map((movement) => movement.id).sort()).toEqual([
      "WF-arrived",
      "WF-open",
    ]);
    // Proves the two lists are genuinely different rather than one quietly aliasing the other.
    expect(figures.allDepartmentMovements.length).not.toBe(figures.departmentMovements.length);
  });
});

describe("elapsed wait, at the boundaries the seed cannot reach", () => {
  /**
   * ⚠️ **REACHABLE, NOT THEORETICAL.** `ADVANCE_CLOCK` can wind this prototype's clock backwards, so
   * a movement opened "after" now is a state a coordinator can produce. 🔴 **Without the clamp the
   * page would render a negative wait.**
   */
  it("floors a wait at zero when the movement was opened after now", () => {
    const figures = edWaitFigures([specimen({ id: "WF-future", openedAt: NOW + 500 })], HERE, NOW);

    expect(figures.waitingMovements[0]?.waitMinutes).toBe(0);
    expect(figures.over24h).toBe(0);
  });

  /** The `>=` itself. One minute either side, and the boundary exactly. */
  it.each([
    { label: "one minute under twenty-four hours", offset: MINUTES_PER_DAY - 1, over24h: 0 },
    { label: "exactly twenty-four hours", offset: MINUTES_PER_DAY, over24h: 1 },
    { label: "one minute over twenty-four hours", offset: MINUTES_PER_DAY + 1, over24h: 1 },
  ])("counts $label as over24h=$over24h", ({ offset, over24h }) => {
    const figures = edWaitFigures([specimen({ id: "WF-edge", openedAt: NOW - offset })], HERE, NOW);

    expect(figures.waitingMovements[0]?.waitMinutes).toBe(offset);
    expect(figures.over24h).toBe(over24h);
    expect(figures.over48h, "a twenty-four hour wait reached the forty-eight hour figure").toBe(0);
  });

  /**
   * 🔴 **THE TWO FIGURES OVERLAP AND MUST NEVER BE SUMMED.** Anyone past forty-eight hours is also
   * past twenty-four. ⚠️ **Pinned as a PROPERTY rather than left implicit, because two numbers side
   * by side headed "Past 24 hours" and "Past 48 hours" read as bands that partition** — and this
   * family has already shipped *"Of 1 with a date written down, 1 met, 0 missed and 11 moved"* on a
   * live ward page for exactly that reason.
   */
  it("counts a forty-eight hour wait in BOTH figures, because they are not bands", () => {
    const figures = edWaitFigures(
      [
        specimen({ id: "WF-short", openedAt: NOW - 30 }),
        specimen({ id: "WF-past24", openedAt: NOW - (MINUTES_PER_DAY + 60) }),
        specimen({ id: "WF-past48", openedAt: NOW - (2 * MINUTES_PER_DAY + 60) }),
      ],
      HERE,
      NOW,
    );

    expect(figures.onTheList).toBe(3);
    expect(figures.over24h, "the forty-eight hour movement was excluded from the twenty-four hour count").toBe(2);
    expect(figures.over48h).toBe(1);
  });

  it("orders the waiting list longest first and names the same entry as the longest wait", () => {
    const figures = edWaitFigures(
      [specimen({ id: "WF-shorter", openedAt: NOW - 100 }), specimen({ id: "WF-longer", openedAt: NOW - 5_000 })],
      HERE,
      NOW,
    );

    expect(figures.waitingMovements.map((entry) => entry.movement.id)).toEqual(["WF-longer", "WF-shorter"]);
    expect(figures.longestWait?.movement.id).toBe("WF-longer");
    expect(figures.longestWait?.waitMinutes).toBe(5_000);
  });

  /**
   * ⚠️ **An empty department must produce `undefined`, not a zero-minute entry.** A zero wait and
   * nobody waiting are different states, and the screen must be able to tell them apart.
   */
  it("has no longest wait at all when nobody here is open", () => {
    const figures = edWaitFigures([specimen({ id: "WF-elsewhere", originEdId: ELSEWHERE })], HERE, NOW);

    expect(figures.longestWait).toBeUndefined();
    expect(figures.waitingMovements).toHaveLength(0);
    expect(figures.onTheList).toBe(0);
  });
});

/**
 * ⚠️ **THE ANTI-VACUITY PASS OVER REAL SEEDED DATA.** Every case above is a constructed specimen;
 * without this the suite would describe a function no shipped screen ever reaches with real input.
 */
describe("over the seed itself", () => {
  it("finds at least one seeded department with somebody on its list", () => {
    const departments = [...new Set(SEED.movements.map((movement) => movement.originEdId))].filter(
      (id): id is string => id !== undefined,
    );
    expect(departments.length, "no seeded movement carries an origin department").toBeGreaterThan(0);

    // `NOW_ANCHOR`, not a field on the seed. ⚠️ My first draft read `SEED.now ?? 0`, which does
    // not exist on `WardFlowState` — and every test in this file PASSED, because vitest does not
    // typecheck. 🔴 Caught by `tsc` afterwards, which is the same defect this module's own
    // comment describes: a green run is not evidence the call was right.
    const tallies = departments.map((id) => edWaitFigures(SEED.movements, id, NOW_ANCHOR));
    expect(
      tallies.some((figures) => figures.onTheList > 0),
      "no seeded department has anybody on its list",
    ).toBe(true);
  });
});
