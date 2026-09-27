// tests/ward-non-binary-single-gender-ward-placement.test.ts
import { describe, expect, it } from "vitest";

import {
  GENDER_PLACEMENT_REASONS,
  GENDER_PLACEMENT_REFUSAL,
} from "../src/components/ward-management/ward-change-reasons";
import { eligibility } from "../src/components/ward-management/ward-eligibility";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { Movement } from "../src/components/ward-management/ward-model";

/**
 * ⚠️ RENAMED AND INVERTED from `ward-non-binary-single-gender-ward-still-refused.test.ts`
 * (see `diff-integrity.json`). Owner reversal, item 2, second round, 17 September 2026:
 * *"No. they actually can. make smallest possible fix to enable this."* A `Non-binary` patient CAN
 * be placed on a single-gender ward once a coordinator has recorded a `GenderPlacement` for THAT
 * unit — the identical procedural record `tests/ward-non-binary-placement.test.ts` already proves
 * unlocks an Undesignated ward, now also read by the `gender_designation` gate itself
 * (`genderDesignationResult`, `ward-eligibility.ts`) for a designated one.
 *
 * `WF-012` (seeded) is `gender: "Non-binary"`; `fsh-adult-secure` (seeded) is the network's one
 * Male-only ward. `rph-adult-secure` is a different, Undesignated Adult Secure unit, used to prove
 * a record for one ward never covers another. Nothing about a binary gender's own refusal changes —
 * the last test below proves the exception is `"Non-binary"` only.
 */

const NOW = 10 * 60;
const MOVEMENT_ID = "WF-012";
const SINGLE_GENDER_WARD = "fsh-adult-secure";
const OTHER_WARD = "rph-adult-secure";
const REASON = GENDER_PLACEMENT_REASONS[0];

function referToUnits(
  state: WardFlowState,
  unitIds: string[],
  overrides: { genderPlacementReason?: string; genderPlacementChecked?: true } = {},
) {
  return wardFlowReducer(state, {
    type: "REFER_TO_UNITS",
    role: "coordinator",
    now: NOW,
    movementId: MOVEMENT_ID,
    unitIds,
    ...overrides,
  } as never);
}

function movementIn(state: WardFlowState): Movement {
  const found = state.movements.find((candidate) => candidate.id === MOVEMENT_ID);
  if (!found) throw new Error(`state is missing movement ${MOVEMENT_ID}`);
  return found;
}

describe("engine: a Non-binary patient can be placed on a single-gender ward with a covering GenderPlacement record", () => {
  it("fixture sanity: WF-012 is seeded Non-binary at placement_requested, and fsh-adult-secure is genuinely Male-only", () => {
    const seeded = seedWardFlowState();
    const movement = movementIn(seeded);
    expect(movement.gender).toBe("Non-binary");
    expect(movement.stage).toBe("placement_requested");
    const unit = seeded.units.find((candidate) => candidate.id === SINGLE_GENDER_WARD);
    expect(unit?.sexDesignation).toBe("Male only");
  });

  it("refuses REFER_TO_UNITS to the Male-only ward with no gender-placement record at all", () => {
    const seeded = seedWardFlowState();
    const after = referToUnits(seeded, [SINGLE_GENDER_WARD]);
    expect(after.rejections.length).toBeGreaterThan(0);
    expect(after.rejections.at(-1)!.reason).toBe(GENDER_PLACEMENT_REFUSAL);
    expect(movementIn(after).referredUnitIds).not.toContain(SINGLE_GENDER_WARD);
  });

  it("REFER_TO_UNITS to the Male-only ward succeeds in one act, given a reason and the ward-checked tick", () => {
    const seeded = seedWardFlowState();
    const after = referToUnits(seeded, [SINGLE_GENDER_WARD], {
      genderPlacementReason: REASON,
      genderPlacementChecked: true,
    });
    expect(after.rejections).toEqual([]);
    const movement = movementIn(after);
    expect(movement.referredUnitIds).toContain(SINGLE_GENDER_WARD);
    expect(movement.genderPlacements).toEqual([
      { at: NOW, by: "coordinator", unitIds: [SINGLE_GENDER_WARD], reason: REASON, wardChecked: true },
    ]);
  });

  it("a record for a DIFFERENT ward does not cover the Male-only ward", () => {
    const seeded = seedWardFlowState();
    const withPlacement = referToUnits(seeded, [OTHER_WARD], {
      genderPlacementReason: REASON,
      genderPlacementChecked: true,
    });
    expect(withPlacement.rejections).toEqual([]);
    expect(movementIn(withPlacement).referredUnitIds).toContain(OTHER_WARD);

    // Attempting the single-gender ward now, with no fresh reason/tick, must still refuse -- the
    // existing record only names `rph-adult-secure`.
    const attempt = referToUnits(withPlacement, [SINGLE_GENDER_WARD]);
    expect(attempt.rejections.length).toBeGreaterThan(0);
    expect(attempt.rejections.at(-1)!.reason).toBe(GENDER_PLACEMENT_REFUSAL);
    expect(movementIn(attempt).referredUnitIds).not.toContain(SINGLE_GENDER_WARD);
  });

  it("a Male patient's placement record for a Female-only ward does not unlock it -- the exception is Non-binary only", () => {
    const seeded = seedWardFlowState();
    const movement = movementIn(seeded);
    const femaleOnlyUnit = seeded.units.find((candidate) => candidate.sexDesignation === "Female only");
    if (!femaleOnlyUnit) throw new Error("seed no longer has a Female-only unit");
    const maleWithPlacement: Movement = {
      ...movement,
      gender: "Male",
      genderPlacements: [
        { at: NOW, by: "coordinator", unitIds: [femaleOnlyUnit.id], reason: REASON, wardChecked: true },
      ],
    };
    const verdict = eligibility(maleWithPlacement, femaleOnlyUnit, NOW);
    const genderGate = verdict.gates.find((gate) => gate.gate === "gender_designation");
    expect(genderGate?.pass).toBe(false);
  });
});
