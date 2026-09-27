import { describe, expect, it } from "vitest";

import { unitHasLockedBeds } from "../src/components/ward-management/ward-bed-designation";
import { OVERRIDE_REASONS } from "../src/components/ward-management/ward-change-reasons";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { Movement, Unit } from "../src/components/ward-management/ward-model";

/**
 * ITEM 10, OWNER ANSWERS 17 SEPTEMBER 2026: *"High-acuity override needs a reason and a 'nurse
 * unit manager consulted' tick."* Before this task, `PULL_PATIENT`'s acuity block asked for a
 * reason alone (`tests/ward-acuity-gate.test.ts`'s own former pin proved it), and the movement
 * update never wrote `overrides` at all — the reason typed in was accepted and then thrown away.
 *
 * ⚠️ **TWO SEPARATE FACTS, AND EITHER ALONE MUST STILL REFUSE.** A reducer that only checked "is
 * `numConsulted` truthy OR `overrideReason` set" would let either one stand in for the other; every
 * pair below is written to catch exactly that substitution, not merely to show the happy path
 * once.
 *
 * Same bench shape as `tests/ward-acuity-gate.test.ts`'s "high-acuity staffing capacity — the
 * pull" block (`fre-older-adult`, widened to six allocatable/empty beds so a refused pull is
 * refused on STAFFING, never on "no bed") — duplicated rather than imported, deliberately: the two
 * files are allowed to diverge without either silently depending on the other's fixture shape.
 */

const UNIT_ID = "fre-older-adult";
const PULL_NOW = 10 * 60 + 42;
const REASON = OVERRIDE_REASONS[0];

function widenedUnit(base: Unit): Unit {
  return {
    ...base,
    beds: 20,
    empty: { ...base.empty, value: 6, confirmedAt: PULL_NOW },
    allocatable: { ...base.allocatable, value: 6, confirmedAt: PULL_NOW },
  };
}

function stagedForPull(source: Movement, id: Movement["id"], overrides: Partial<Movement> = {}): Movement {
  return {
    ...source,
    id,
    highAcuity: false,
    // Isolated from the specialling gate by default, the identical reasoning
    // `ward-acuity-gate.test.ts`'s own `stagedForPull` states: `fre-older-adult` staffs only 1
    // specialling place too, and an inherited `specialling: true` from the seeded source movement
    // would collide with a different capacity check than the one each test below means to drive.
    specialling: false,
    stage: "accepted_awaiting_bed",
    acceptedUnitId: UNIT_ID,
    referredUnitIds: [],
    declines: [],
    closure: undefined,
    transport: undefined,
    pullExpiresAt: undefined,
    admissionId: undefined,
    ...overrides,
  };
}

function bench(): WardFlowState {
  const seeded = seedWardFlowState();
  const base = seeded.units.find((candidate) => candidate.id === UNIT_ID);
  if (!base) throw new Error(`the seed no longer contains unit ${UNIT_ID}`);
  if (base.highAcuityCapacity !== 1 || base.speciallingCapacity !== 1) {
    throw new Error(`${UNIT_ID} is no longer authored with 1 high-acuity and 1 specialling capacity`);
  }

  const unit = widenedUnit(base);
  const unitSecurityWord = unitHasLockedBeds(unit) ? "Secure" : "Open";
  const sources = seeded.movements.filter(
    (candidate) => candidate.cohort === unit.cohort && candidate.security === unitSecurityWord,
  );
  if (sources.length < 4) {
    throw new Error(
      `the seed no longer holds four ${unitSecurityWord} ${unit.cohort} movements to rewrite ` +
        `(found ${sources.length}) — this file must not fall back to a clinically wrong placement`,
    );
  }

  return {
    ...seeded,
    units: seeded.units.map((candidate) => (candidate.id === UNIT_ID ? unit : candidate)),
    movements: [
      stagedForPull(sources[0], "WF-ACN-FIRST", { highAcuity: true }),
      stagedForPull(sources[1], "WF-ACN-SECOND", { highAcuity: true }),
      stagedForPull(sources[2], "WF-ACN-SPEC-FIRST", { specialling: true }),
      stagedForPull(sources[3], "WF-ACN-SPEC-SECOND", { specialling: true }),
    ],
    admissions: seeded.admissions.filter((admission) => admission.unitId !== UNIT_ID),
    bedReleases: seeded.bedReleases.filter((release) => release.unitId !== UNIT_ID),
    rejections: [],
  };
}

function movementIn(state: WardFlowState, id: string): Movement {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

function pull(
  state: WardFlowState,
  movementId: string,
  overrideReason?: (typeof OVERRIDE_REASONS)[number],
  numConsulted?: true,
): WardFlowState {
  return wardFlowReducer(state, {
    type: "PULL_PATIENT",
    role: "ward",
    now: PULL_NOW,
    movementId,
    unitId: UNIT_ID,
    overrideReason,
    numConsulted,
  });
}

describe("the high-acuity override needs both a reason and the nurse unit manager tick", () => {
  it("refuses a reason with no tick", () => {
    const first = pull(bench(), "WF-ACN-FIRST");
    expect(first.rejections, "the first high-acuity pull must succeed, or nothing below proves anything").toEqual([]);

    const second = pull(first, "WF-ACN-SECOND", REASON);
    expect(second.rejections, "a reason with no tick must be refused").toHaveLength(1);
    expect(second.rejections[0].reason).toMatch(/nurse unit manager consulted/i);
    expect(movementIn(second, "WF-ACN-SECOND").stage).toBe("accepted_awaiting_bed");
    expect(movementIn(second, "WF-ACN-SECOND").admissionId).toBeUndefined();
    expect(movementIn(second, "WF-ACN-SECOND").overrides, "a refused pull must record no override").toEqual([]);
  });

  it("refuses the tick with no reason", () => {
    const first = pull(bench(), "WF-ACN-FIRST");
    const second = pull(first, "WF-ACN-SECOND", undefined, true);

    expect(second.rejections, "a tick with no reason must be refused").toHaveLength(1);
    expect(movementIn(second, "WF-ACN-SECOND").stage).toBe("accepted_awaiting_bed");
    expect(movementIn(second, "WF-ACN-SECOND").overrides, "a refused pull must record no override").toEqual([]);
  });

  it("refuses an unrecognised reason string even with the tick — membership, never truthiness", () => {
    const first = pull(bench(), "WF-ACN-FIRST");
    const second = wardFlowReducer(first, {
      type: "PULL_PATIENT",
      role: "ward",
      now: PULL_NOW,
      movementId: "WF-ACN-SECOND",
      unitId: UNIT_ID,
      // A plausible sentence that is not on the owner's list — the same discipline every other
      // override site in this reducer is held to.
      overrideReason: "Ward manager agreed on the phone" as never,
      numConsulted: true,
    });
    expect(second.rejections).toHaveLength(1);
    expect(movementIn(second, "WF-ACN-SECOND").overrides).toEqual([]);
  });

  it("places the patient and records exactly one override, naming the unit, when both are given", () => {
    const first = pull(bench(), "WF-ACN-FIRST");
    const second = pull(first, "WF-ACN-SECOND", REASON, true);

    expect(second.rejections, "reason and tick together must get the placement through").toEqual([]);
    const placed = movementIn(second, "WF-ACN-SECOND");
    expect(placed.stage).toBe("pulled");
    expect(placed.overrides).toHaveLength(1);
    expect(placed.overrides[0]).toMatchObject({
      reason: REASON,
      unitIds: [UNIT_ID],
      numConsulted: true,
      gate: "high_acuity_staffing",
    });
  });

  it("records nothing extra for the FIRST pull, which needed no override at all", () => {
    const first = pull(bench(), "WF-ACN-FIRST");
    expect(movementIn(first, "WF-ACN-FIRST").overrides, "an unforced pull must not record an override").toEqual([]);
  });

  it("specialling accepts a reason alone and records the gate that required it", () => {
    const first = pull(bench(), "WF-ACN-SPEC-FIRST");
    expect(first.rejections, "the first specialling pull must succeed, or this proves nothing").toEqual([]);

    const second = pull(first, "WF-ACN-SPEC-SECOND", REASON);
    expect(second.rejections, "specialling must still be answerable by a reason alone, unlike acuity").toEqual([]);
    const placed = movementIn(second, "WF-ACN-SPEC-SECOND");
    expect(placed.stage).toBe("pulled");
    expect(placed.overrides).toHaveLength(1);
    expect(placed.overrides[0]).toMatchObject({
      reason: REASON,
      unitIds: [UNIT_ID],
      gate: "specialling_staffing",
    });
    expect(placed.overrides[0].numConsulted).not.toBe(true);
  });
});
