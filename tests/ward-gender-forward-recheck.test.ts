// tests/ward-gender-forward-recheck.test.ts
import { describe, expect, it } from "vitest";

import {
  GENDER_NO_LONGER_SUITS_REFUSAL,
  GENDER_NO_LONGER_SUITS_NON_BINARY_REFUSAL,
  GENDER_PLACEMENT_REASONS,
} from "../src/components/ward-management/ward-change-reasons";
import { isOpen } from "../src/components/ward-management/ward-derivations";
import { eligibility } from "../src/components/ward-management/ward-eligibility";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import type { Movement, MovementStage } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR, unitById } from "../src/components/ward-management/ward-sites";

/**
 * P1-3 (Ward Lead ruling, 17 September 2026): "a gender corrected after placement is never
 * re-checked". Proven three ways, matching the three red scenarios the brief measured against the
 * unpatched engine:
 *
 *  1. A binary correction (Male -> Female) that makes an already-held Male-only bed unsuitable is
 *     now caught the next time the movement tries to move forward (`HANDOVER_READY` here), rather
 *     than sailing through to arrival with no warning.
 *  2. A correction to `Non-binary` while a bed is already held at an Undesignated ward — which
 *     passes `gender_designation` trivially — is caught by the SEPARATE non-binary placement-record
 *     check, which is unconditional regardless of the ward's own designation.
 *  3. `PULL_PATIENT`'s own non-binary refusal, for a movement staged straight at
 *     `accepted_awaiting_bed` with no covering record, now states the real route out
 *     (`GENDER_NO_LONGER_SUITS_NON_BINARY_REFUSAL`) instead of the old generic
 *     `GENDER_PLACEMENT_REFUSAL`, which never said what to do next.
 *
 * Each scenario is PAIRED with a control proving the refusal is caused by the correction and not
 * some unrelated gate — the same discipline `ward-acuity-gate.test.ts`'s own header comment states:
 * "a gate wired to nothing... passes a one-sided suite in full and reports the same green as a
 * working one."
 */

const NOW = NOW_ANCHOR + 10;

function movement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: "WF-P13-TEST",
    originEdId: "fsh-ed",
    openedAt: NOW - 300,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Adult",
    security: "Secure",
    sex: "Male",
    gender: "Male",
    specialling: false,
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "pulled",
    owner: "Flow coordinator",
    referredUnitIds: [],
    declines: [],
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    blocker: "No blocker",
    transport: {
      id: "TR-P13-TEST",
      provider: "Patient transport service",
      escortRequired: false,
    },
    ...overrides,
  };
}

function bench(movements: Movement[]): WardFlowState {
  const seeded = seedWardFlowState();
  return { ...seeded, movements, rejections: [], notices: [] };
}

function movementIn(state: WardFlowState, id: string): Movement {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

describe("P1-3 scenario 1: a binary gender correction while a bed is held is caught at the next forward step", () => {
  const UNIT_ID = "fsh-adult-secure"; // the network's one Male-only ward

  it("control: an uncorrected Male movement clears HANDOVER_READY at the Male-only ward", () => {
    const state = bench([movement({ id: "WF-P13-CONTROL", acceptedUnitId: UNIT_ID })]);
    const after = wardFlowReducer(state, {
      type: "HANDOVER_READY",
      role: "ed",
      now: NOW,
      movementId: "WF-P13-CONTROL",
    });
    expect(after.rejections).toEqual([]);
    expect(movementIn(after, "WF-P13-CONTROL").stage).toBe("handover_ready");
  });

  it("a correction to Female raises a coordinator notice and then refuses HANDOVER_READY", () => {
    const state = bench([movement({ acceptedUnitId: UNIT_ID })]);
    const corrected = wardFlowReducer(state, {
      type: "RECORD_MOVEMENT_GENDER",
      role: "coordinator",
      now: NOW,
      movementId: "WF-P13-TEST",
      gender: "Female",
    });
    expect(corrected.rejections).toEqual([]);
    const notice = corrected.notices.find((candidate) => candidate.kind === "movement_gender_recorded_after_placement");
    expect(notice, "the coordinator must be told a held placement may no longer suit").toBeDefined();
    expect(notice?.to).toEqual({ role: "coordinator" });
    expect(notice?.about.movementId).toBe("WF-P13-TEST");

    const after = wardFlowReducer(corrected, {
      type: "HANDOVER_READY",
      role: "ed",
      now: NOW + 5,
      movementId: "WF-P13-TEST",
    });
    // ⚠️ THIS IS THE RED-TO-GREEN LINE. Before `heldUnitGenderRefusal` existed, this dispatch
    // succeeded — a Female patient handed over toward a Male-only ward with nobody warned, exactly
    // P1-3's scenario 1 ("Book -> handover -> accept -> en route -> collect -> arrive are all
    // accepted"). `heldUnitGenderRefusal` re-runs the gate the same way `PULL_PATIENT` already did
    // and refuses BEFORE the stage advances.
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0]!.reason).toBe(GENDER_NO_LONGER_SUITS_REFUSAL);
    expect(movementIn(after, "WF-P13-TEST").stage, "the stage must not have advanced").toBe("pulled");
  });

  it("never mentions sex, gender or non-binary — the wording is the ward-safe sentence already", () => {
    expect(GENDER_NO_LONGER_SUITS_REFUSAL.toLowerCase()).not.toMatch(/\bgender\b|\bsex\b|non-binary/);
  });
});

/**
 * `heldUnitGenderRefusal` (`ward-flow-reducer.ts`) is ONE function called from all four forward
 * steps the ruling names. `HANDOVER_READY` above proves the function fires; this proves the OTHER
 * THREE call sites actually call it too, rather than trusting that a shared helper was wired in
 * everywhere it was supposed to be.
 */
describe("P1-3: every named forward step refuses once the held ward no longer suits", () => {
  const UNIT_ID = "fsh-adult-secure";

  function heldAt(stage: MovementStage, transport: Movement["transport"]): Movement {
    return movement({ stage, acceptedUnitId: UNIT_ID, gender: "Female", transport });
  }

  it("PULL_PATIENT", () => {
    const state = bench([heldAt("accepted_awaiting_bed", undefined)]);
    const after = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "ward",
      now: NOW,
      movementId: "WF-P13-TEST",
      unitId: UNIT_ID,
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0]!.reason).toBe(GENDER_NO_LONGER_SUITS_REFUSAL);
  });

  it("HANDOVER_READY", () => {
    const state = bench([
      heldAt("pulled", { id: "TR-A", provider: "Patient transport service", escortRequired: false }),
    ]);
    const after = wardFlowReducer(state, { type: "HANDOVER_READY", role: "ed", now: NOW, movementId: "WF-P13-TEST" });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0]!.reason).toBe(GENDER_NO_LONGER_SUITS_REFUSAL);
  });

  it("TRANSPORT_ACCEPTED", () => {
    const state = bench([
      heldAt("handover_ready", { id: "TR-B", provider: "Patient transport service", escortRequired: false }),
    ]);
    const after = wardFlowReducer(state, {
      type: "TRANSPORT_ACCEPTED",
      role: "officer",
      now: NOW,
      movementId: "WF-P13-TEST",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0]!.reason).toBe(GENDER_NO_LONGER_SUITS_REFUSAL);
  });

  it("PATIENT_COLLECTED", () => {
    const state = bench([
      heldAt("handover_ready", {
        id: "TR-C",
        provider: "Patient transport service",
        escortRequired: false,
        acceptedAt: NOW - 20,
        enRouteAt: NOW - 10,
      }),
    ]);
    const after = wardFlowReducer(state, {
      type: "PATIENT_COLLECTED",
      role: "officer",
      now: NOW,
      movementId: "WF-P13-TEST",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0]!.reason).toBe(GENDER_NO_LONGER_SUITS_REFUSAL);
  });

  it("PATIENT_ARRIVED is deliberately NOT re-checked — blocking an arrival strands a patient in transit", () => {
    const moving = movement({
      stage: "moving",
      acceptedUnitId: UNIT_ID,
      gender: "Female",
      security: "Secure",
      transport: {
        id: "TR-D",
        provider: "Patient transport service",
        escortRequired: false,
        acceptedAt: NOW - 30,
        enRouteAt: NOW - 20,
        collectedAt: NOW - 10,
      },
    });
    const state = bench([moving]);
    const after = wardFlowReducer(state, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: NOW,
      movementId: "WF-P13-TEST",
      actingUnitId: UNIT_ID,
    });
    // Arrival is refused only if it would be for an unrelated reason (e.g. no empty bed); it must
    // NEVER be refused for `GENDER_NO_LONGER_SUITS_REFUSAL` specifically — that is the one gate
    // this event deliberately never re-asks.
    expect(after.rejections.map((rejection) => rejection.reason)).not.toContain(GENDER_NO_LONGER_SUITS_REFUSAL);
  });
});

describe("P1-3 scenario 2: a correction to Non-binary while held at an Undesignated ward is caught before arrival", () => {
  const UNIT_ID = "bun-adult-open"; // Adult, Open, Undesignated — gender_designation passes trivially

  function baseMovement(overrides: Partial<Movement> = {}): Movement {
    return movement({ security: "Open", acceptedUnitId: UNIT_ID, ...overrides });
  }

  it("control: an uncorrected Male movement clears HANDOVER_READY at the Undesignated ward", () => {
    const state = bench([baseMovement({ id: "WF-P13-CONTROL2" })]);
    const after = wardFlowReducer(state, {
      type: "HANDOVER_READY",
      role: "ed",
      now: NOW,
      movementId: "WF-P13-CONTROL2",
    });
    expect(after.rejections).toEqual([]);
  });

  it("a correction to Non-binary passes gender_designation trivially but is refused for want of a placement record", () => {
    const state = bench([baseMovement()]);

    // `gender_designation` alone would pass here — `bun-adult-open` is Undesignated and takes any
    // gender — which is exactly why P1-3 names this as a SEPARATE scenario from scenario 1: the
    // non-binary placement-record check is the one that must fire, not the designation gate.
    const unit = unitById(UNIT_ID)!;
    const gateBeforeCorrection = eligibility(movementIn(state, "WF-P13-TEST"), unit, NOW).gates.find(
      (g) => g.gate === "gender_designation",
    );
    expect(gateBeforeCorrection?.pass).toBe(true);

    const corrected = wardFlowReducer(state, {
      type: "RECORD_MOVEMENT_GENDER",
      role: "coordinator",
      now: NOW,
      movementId: "WF-P13-TEST",
      gender: "Non-binary",
    });
    expect(corrected.rejections).toEqual([]);
    expect(corrected.notices.some((notice) => notice.kind === "movement_gender_recorded_after_placement")).toBe(true);

    const gateAfterCorrection = eligibility(movementIn(corrected, "WF-P13-TEST"), unit, NOW).gates.find(
      (g) => g.gate === "gender_designation",
    );
    expect(gateAfterCorrection?.pass, "gender_designation alone would still pass — Undesignated takes any gender").toBe(
      true,
    );

    const after = wardFlowReducer(corrected, {
      type: "HANDOVER_READY",
      role: "ed",
      now: NOW + 5,
      movementId: "WF-P13-TEST",
    });
    // ⚠️ RED-TO-GREEN: before this fix, nothing stopped this movement moving on to arrive with no
    // placement record at all — P1-3's scenario 2 ("Non-binary recorded while pulled at an
    // undesignated ward: arrives with no placement record").
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0]!.reason).toBe(GENDER_NO_LONGER_SUITS_NON_BINARY_REFUSAL);
    expect(movementIn(after, "WF-P13-TEST").stage).toBe("pulled");
  });
});

describe("P1-3 scenario 3: PULL_PATIENT states the real route out for a non-binary placement recorded after acceptance", () => {
  const UNIT_ID = "bun-adult-open";

  it("refuses with the actionable sentence, not the old generic one", () => {
    const staged = movement({
      stage: "accepted_awaiting_bed",
      gender: "Non-binary",
      acceptedUnitId: UNIT_ID,
      security: "Open",
      transport: undefined,
    });
    const state = bench([staged]);
    const after = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "ward",
      now: NOW,
      movementId: "WF-P13-TEST",
      unitId: UNIT_ID,
    });
    expect(after.rejections).toHaveLength(1);
    // ⚠️ RED-TO-GREEN: was `GENDER_PLACEMENT_REFUSAL` ("A coordinator must record a reason…"),
    // which never named the withdraw-and-refer-again route P1-3's scenario 3 says is "never
    // stated". `REFER_TO_UNITS` cannot answer at this stage either (the movement is not at
    // `destination_review`), so the withdraw step is the one thing that actually gets somebody
    // unstuck, and the message now says so.
    expect(after.rejections[0]!.reason).toBe(GENDER_NO_LONGER_SUITS_NON_BINARY_REFUSAL);
    expect(after.rejections[0]!.reason).toMatch(/withdraw the acceptance/i);
    expect(movementIn(after, "WF-P13-TEST").admissionId).toBeUndefined();
  });

  it("(unused import guard) GENDER_PLACEMENT_REASONS still has entries a coordinator can record after withdrawing", () => {
    expect(GENDER_PLACEMENT_REASONS.length).toBeGreaterThan(0);
  });
});

describe("RECORD_MOVEMENT_GENDER's coordinator notice is scoped to held stages only", () => {
  const HELD_STAGES: readonly MovementStage[] = ["accepted_awaiting_bed", "pulled", "handover_ready", "moving"];

  it("raises no notice for a correction at placement_requested — nothing is held yet", () => {
    const staged = movement({ stage: "placement_requested", acceptedUnitId: undefined, transport: undefined });
    const state = bench([staged]);
    const after = wardFlowReducer(state, {
      type: "RECORD_MOVEMENT_GENDER",
      role: "coordinator",
      now: NOW,
      movementId: "WF-P13-TEST",
      gender: "Female",
    });
    expect(after.rejections).toEqual([]);
    expect(after.notices).toEqual([]);
  });

  it("raises no notice for a correction at destination_review — nothing is held yet", () => {
    const staged = movement({
      stage: "destination_review",
      acceptedUnitId: undefined,
      referredUnitIds: ["fsh-adult-secure"],
      transport: undefined,
    });
    const state = bench([staged]);
    const after = wardFlowReducer(state, {
      type: "RECORD_MOVEMENT_GENDER",
      role: "coordinator",
      now: NOW,
      movementId: "WF-P13-TEST",
      gender: "Female",
    });
    expect(after.rejections).toEqual([]);
    expect(after.notices).toEqual([]);
  });

  it("raises a notice for every held stage named in the ruling", () => {
    for (const stage of HELD_STAGES) {
      const staged = movement({ stage, acceptedUnitId: "fsh-adult-secure" });
      const state = bench([staged]);
      const after = wardFlowReducer(state, {
        type: "RECORD_MOVEMENT_GENDER",
        role: "coordinator",
        now: NOW,
        movementId: "WF-P13-TEST",
        gender: "Female",
      });
      expect(after.rejections, `stage ${stage}`).toEqual([]);
      expect(
        after.notices.some((notice) => notice.kind === "movement_gender_recorded_after_placement"),
        `stage ${stage} must raise the notice`,
      ).toBe(true);
    }
  });
});

/**
 * P2-7: two seeded records no reducer path could actually produce, both fixed in `ward-movements.ts`.
 * This invariant sweep is the general guard so a THIRD one cannot land unnoticed: every open
 * movement holding a bed or an acceptance must still pass `gender_designation` for that unit, and
 * every `Non-binary` one among them must carry a covering placement record.
 */
describe("P2-7 invariant: every held, open movement's gender still suits its accepted unit", () => {
  const HELD_STAGES: readonly MovementStage[] = ["accepted_awaiting_bed", "pulled", "handover_ready", "moving"];
  const heldOpenMovements = wardMovements.filter(
    (candidate) => isOpen(candidate) && HELD_STAGES.includes(candidate.stage) && candidate.acceptedUnitId !== undefined,
  );

  it("has movements to check, so this cannot pass by scanning nothing", () => {
    expect(heldOpenMovements.length).toBeGreaterThan(0);
  });

  it("passes the gender_designation gate for its accepted unit (covers WF-318)", () => {
    const failing: Array<{ id: string; reason: string }> = [];
    for (const candidate of heldOpenMovements) {
      const unit = unitById(candidate.acceptedUnitId as string);
      if (!unit) {
        failing.push({ id: candidate.id, reason: "accepted unit does not exist" });
        continue;
      }
      const gate = eligibility(candidate, unit, NOW_ANCHOR).gates.find((g) => g.gate === "gender_designation");
      if (!gate || !gate.pass) {
        failing.push({ id: candidate.id, reason: gate?.detail ?? "no gender_designation gate" });
      }
    }
    expect(failing).toEqual([]);
  });

  it("gives every Non-binary movement among them a covering placement record (covers WF-026)", () => {
    const uncovered = heldOpenMovements
      .filter((candidate) => candidate.gender === "Non-binary")
      .filter(
        (candidate) =>
          !(candidate.genderPlacements ?? []).some((record) =>
            record.unitIds.includes(candidate.acceptedUnitId as string),
          ),
      )
      .map((candidate) => candidate.id);
    expect(uncovered).toEqual([]);
  });
});
