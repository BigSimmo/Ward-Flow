// tests/ward-refusal-gaps-legal-and-diversion.test.ts
//
// REFUSALS NO TEST HAD EVER REACHED — BATCH THREE: diversion, the two long-stay admission
// setters, an unlisted legal form on a continuation, an unlisted expect-flag kind, and the two
// guards on overriding a legal mismatch.
//
// 🔴 TWO OF THE TEN LINES NAMED IN THE BRIEF TURN OUT TO BE THE SAME DEAD SHAPE
// `tests/ward-refusal-gaps-transport.test.ts` already found: `RECORD_DIVERSION`'s own
// "already arrived" and "already stopped or cancelled" guards sit below a `movement.closure`
// check, and both states they describe imply a closed movement —
//
//   - `PATIENT_ARRIVED` is the only writer of `transport.arrivedAt`, and it writes `closure` in
//     the same object literal (see that case's own comment: "THIS IS THE EVENT THAT MAY WRITE
//     `arrivedAt`, AND IT IS THE ONLY ONE").
//   - `STOP_TRANSPORT` is the only writer of `transport.stoppedAt`, and it writes
//     `transport.cancelledAt` and `movement.closure` together in the same object literal — and
//     every OTHER writer of `transport.cancelledAt` (RECORD_ED_OUTCOME, REFER_TO_COMMUNITY_TEAM,
//     RECORD_EXAMINATION, WITHDRAW_REFERRAL, RECORD_REFERRER_WITHDRAWAL, RELEASE_DIVERTED_BED)
//     writes a `closure` beside it too.
//
// So by the time either condition could be true, `movement.closure` is already set, and
// `RECORD_DIVERSION`'s own closure check (the first thing the case does) has already refused.
// Nobody is less safe for it — diverting a closed movement is refused either way — but the
// SENTENCE named in the brief is one nothing can ever say. These two cases are written the same
// way `ward-refusal-gaps-transport.test.ts` writes its dead guards: pinning what actually happens
// and asserting the dead wording is absent, not fabricating a state to force it.
//
// The other six lines are ordinary, reachable refusals, each with its control.
import { describe, expect, it } from "vitest";

import type { WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { daysInBed } from "../src/components/ward-management/ward-admissions";
import {
  DIVERSION_REASONS,
  OVERRIDE_REASONS,
  STOP_TRANSPORT_REASONS,
  TRANSPORT_WHEREABOUTS,
} from "../src/components/ward-management/ward-change-reasons";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

// The cast IS the test, so it is named rather than inlined — same discipline as the other two
// files in this series.
const OFF_LIST = "not-a-value-this-model-knows";

function added(before: WardFlowState, after: WardFlowState) {
  return after.rejections.slice(before.rejections.length).map((rejection) => rejection.reason);
}

describe("RECORD_DIVERSION: has no transport job to divert (line 7358)", () => {
  // WF-001 arrives from the seed as `placement_requested`, referred without a raised referral —
  // no transport job has ever been booked for it, and it carries no closure.
  const MOVEMENT_NO_TRANSPORT = "WF-001";
  // WF-005 arrives from the seed at `handover_ready` with its transport already accepted, the same
  // movement `ward-refusal-gaps-transport.test.ts` walks to "collected".
  const MOVEMENT_WITH_TRANSPORT = "WF-005";

  function driveToCollected(): WardFlowState {
    let state = seedWardFlowState();
    for (const step of [
      { type: "TRANSPORT_EN_ROUTE", role: "officer", now: NOW + 1, movementId: MOVEMENT_WITH_TRANSPORT },
      { type: "PATIENT_COLLECTED", role: "officer", now: NOW + 2, movementId: MOVEMENT_WITH_TRANSPORT },
    ] as const) {
      const before = state;
      state = wardFlowReducer(state, step as never);
      expect(added(before, state), `the walk to collected was refused at ${step.type}`).toEqual([]);
    }
    return state;
  }

  it("refuses a diversion on a movement with no transport job", () => {
    const seeded = seedWardFlowState();
    const before = seeded;
    const movement = seeded.movements.find((m) => m.id === MOVEMENT_NO_TRANSPORT);
    if (!movement) throw new Error(`the seed no longer carries movement ${MOVEMENT_NO_TRANSPORT}`);
    expect(movement.transport, "this fixture no longer starts with no transport job — pick another").toBeUndefined();
    expect(movement.closure, "this fixture is no longer open — pick another").toBeUndefined();

    const after = wardFlowReducer(seeded, {
      type: "RECORD_DIVERSION",
      role: "coordinator",
      now: NOW + 1,
      movementId: MOVEMENT_NO_TRANSPORT,
      reason: DIVERSION_REASONS[0],
      place: TRANSPORT_WHEREABOUTS[0],
    });
    expect(added(before, after)).toEqual([`movement ${MOVEMENT_NO_TRANSPORT} has no transport job to divert`]);
  });

  it("CONTROL: the same event succeeds once the movement has a collected transport job", () => {
    const collected = driveToCollected();
    const after = wardFlowReducer(collected, {
      type: "RECORD_DIVERSION",
      role: "coordinator",
      now: NOW + 3,
      movementId: MOVEMENT_WITH_TRANSPORT,
      reason: DIVERSION_REASONS[0],
      place: TRANSPORT_WHEREABOUTS[0],
    });
    const reasons = added(collected, after);
    expect(reasons).not.toContain(`movement ${MOVEMENT_WITH_TRANSPORT} has no transport job to divert`);
    expect(reasons).toEqual([]);
    const diverted = after.movements.find((m) => m.id === MOVEMENT_WITH_TRANSPORT);
    expect(diverted?.transport?.diversion, "the diversion was not actually recorded").toBeDefined();
  });
});

describe("RECORD_DIVERSION: 'already arrived' and 'already stopped or cancelled' are unreachable (lines 7368, 7371)", () => {
  const MOVEMENT = "WF-005";

  function driveTo(stop: "collected" | "arrived"): WardFlowState {
    let state = seedWardFlowState();
    const steps = [
      { type: "TRANSPORT_EN_ROUTE", role: "officer", now: NOW + 1, movementId: MOVEMENT },
      { type: "PATIENT_COLLECTED", role: "officer", now: NOW + 2, movementId: MOVEMENT },
      ...(stop === "arrived" ? [{ type: "PATIENT_ARRIVED", role: "officer", now: NOW + 3, movementId: MOVEMENT }] : []),
    ] as const;
    for (const step of steps) {
      const before = state;
      state = wardFlowReducer(state, step as never);
      expect(added(before, state), `the walk to "${stop}" was refused at ${step.type}`).toEqual([]);
    }
    return state;
  }

  function stopTransport(state: WardFlowState, now: number) {
    return wardFlowReducer(state, {
      type: "STOP_TRANSPORT",
      role: "coordinator",
      now,
      movementId: MOVEMENT,
      reason: STOP_TRANSPORT_REASONS[0],
      whereabouts: TRANSPORT_WHEREABOUTS[0],
    });
  }

  function recordDiversion(state: WardFlowState, now: number) {
    return wardFlowReducer(state, {
      type: "RECORD_DIVERSION",
      role: "coordinator",
      now,
      movementId: MOVEMENT,
      reason: DIVERSION_REASONS[0],
      place: TRANSPORT_WHEREABOUTS[0],
    });
  }

  it("an arrival closes the movement, so the diversion 'already arrived' guard sits behind a door that is always shut", () => {
    const arrived = driveTo("arrived");
    const movement = arrived.movements.find((m) => m.id === MOVEMENT);
    expect(movement?.transport?.arrivedAt, "the patient did not actually arrive").toBeDefined();
    expect(
      movement?.closure,
      "arrival no longer closes the movement — the diversion arrival guard may now be reachable, and wants a real test",
    ).toBeDefined();
  });

  it("diverting after arrival is refused as a closed movement, never as 'already arrived'", () => {
    const arrived = driveTo("arrived");
    const reasons = added(arrived, recordDiversion(arrived, NOW + 4));
    expect(reasons).toEqual(["cannot divert a closed movement (Patient arrived at the accepting unit)"]);
    expect(reasons[0]).not.toContain("already arrived");
  });

  it("a stop records a cancellation and a closure together, so the diversion 'already stopped or cancelled' guard sits behind the same shut door", () => {
    const stopped = stopTransport(driveTo("collected"), NOW + 3);
    const movement = stopped.movements.find((m) => m.id === MOVEMENT);
    expect(movement?.transport?.stoppedAt, "stopping recorded no stop").toBeDefined();
    expect(
      movement?.closure,
      "a stopped journey no longer closes its movement — the diversion cancellation guard may now be reachable",
    ).toBeDefined();
  });

  it("diverting after a stop is refused as a closed movement, never as 'already stopped or cancelled'", () => {
    const stopped = stopTransport(driveTo("collected"), NOW + 3);
    const reasons = added(stopped, recordDiversion(stopped, NOW + 4));
    expect(reasons).toEqual(["cannot divert a closed movement (The examination was revoked)"]);
    expect(reasons[0]).not.toContain("already stopped or cancelled");
  });
});

describe("RECORD_DIVERSION: place must be chosen from TRANSPORT_WHEREABOUTS (line 7380)", () => {
  const MOVEMENT = "WF-005";

  function driveToCollected(): WardFlowState {
    let state = seedWardFlowState();
    for (const step of [
      { type: "TRANSPORT_EN_ROUTE", role: "officer", now: NOW + 1, movementId: MOVEMENT },
      { type: "PATIENT_COLLECTED", role: "officer", now: NOW + 2, movementId: MOVEMENT },
    ] as const) {
      const before = state;
      state = wardFlowReducer(state, step as never);
      expect(added(before, state), `the walk to collected was refused at ${step.type}`).toEqual([]);
    }
    return state;
  }

  it("refuses a place that is not in TRANSPORT_WHEREABOUTS", () => {
    const collected = driveToCollected();
    const off = wardFlowReducer(collected, {
      type: "RECORD_DIVERSION",
      role: "coordinator",
      now: NOW + 3,
      movementId: MOVEMENT,
      reason: DIVERSION_REASONS[0],
      place: OFF_LIST as never,
    });
    expect(added(collected, off)).toEqual(["RECORD_DIVERSION place must be chosen from TRANSPORT_WHEREABOUTS"]);
  });

  it("CONTROL: a place the model knows is accepted", () => {
    const collected = driveToCollected();
    const on = wardFlowReducer(collected, {
      type: "RECORD_DIVERSION",
      role: "coordinator",
      now: NOW + 3,
      movementId: MOVEMENT,
      reason: DIVERSION_REASONS[0],
      place: TRANSPORT_WHEREABOUTS[0],
    });
    const reasons = added(collected, on);
    expect(reasons).not.toContain("RECORD_DIVERSION place must be chosen from TRANSPORT_WHEREABOUTS");
    expect(reasons).toEqual([]);
  });
});

describe("SET_STEP_DOWN_CANDIDATE: claim-not-proof actingUnitId (line 7886)", () => {
  // AD-RPHS-01 is a real seeded occupied admission, 34 days into its stay — long enough that a
  // discharge-barrier control on the sibling admission below succeeds outright, and it doubles as
  // the admission this case tags too.
  const ADMISSION = "AD-RPHS-01";
  const REAL_UNIT = "rph-adult-secure";
  const WRONG_UNIT = "scgh-adult-open";

  it("refuses a ward caller whose actingUnitId does not match the admission's unit", () => {
    const seeded = seedWardFlowState();
    const admission = seeded.admissions.find((a) => a.id === ADMISSION);
    if (!admission) throw new Error(`the seed no longer carries admission ${ADMISSION}`);
    expect(admission.unitId).toBe(REAL_UNIT);

    const after = wardFlowReducer(seeded, {
      type: "SET_STEP_DOWN_CANDIDATE",
      role: "ward",
      now: NOW,
      actingUnitId: WRONG_UNIT,
      admissionId: ADMISSION,
      stepDownCandidate: true,
    });
    expect(added(seeded, after)).toEqual([
      `SET_STEP_DOWN_CANDIDATE was raised acting as unit ${WRONG_UNIT} but admission ${ADMISSION} is at ${REAL_UNIT}`,
    ]);
  });

  it("CONTROL: the same event succeeds once actingUnitId matches the admission's real unit", () => {
    const seeded = seedWardFlowState();
    const after = wardFlowReducer(seeded, {
      type: "SET_STEP_DOWN_CANDIDATE",
      role: "ward",
      now: NOW,
      actingUnitId: REAL_UNIT,
      admissionId: ADMISSION,
      stepDownCandidate: true,
    });
    const reasons = added(seeded, after);
    expect(reasons).not.toContain(
      `SET_STEP_DOWN_CANDIDATE was raised acting as unit ${WRONG_UNIT} but admission ${ADMISSION} is at ${REAL_UNIT}`,
    );
    expect(reasons).toEqual([]);
    expect(after.admissions.find((a) => a.id === ADMISSION)?.stepDownCandidate).toBe(true);
  });
});

describe("SET_DISCHARGE_BARRIER: claim-not-proof actingUnitId (line 7908)", () => {
  const ADMISSION = "AD-RPHS-01";
  const REAL_UNIT = "rph-adult-secure";
  const WRONG_UNIT = "scgh-adult-open";

  it("refuses a ward caller whose actingUnitId does not match the admission's unit", () => {
    const seeded = seedWardFlowState();
    const admission = seeded.admissions.find((a) => a.id === ADMISSION);
    if (!admission) throw new Error(`the seed no longer carries admission ${ADMISSION}`);
    expect(admission.unitId).toBe(REAL_UNIT);
    // Long stay confirmed, so the control below cannot be mistaken for tripping the separate
    // 7-day guard instead.
    expect(daysInBed(admission, NOW) ?? 0).toBeGreaterThanOrEqual(7);

    const after = wardFlowReducer(seeded, {
      type: "SET_DISCHARGE_BARRIER",
      role: "ward",
      now: NOW,
      actingUnitId: WRONG_UNIT,
      admissionId: ADMISSION,
      barrier: "NDIS",
    });
    expect(added(seeded, after)).toEqual([
      `SET_DISCHARGE_BARRIER was raised acting as unit ${WRONG_UNIT} but admission ${ADMISSION} is at ${REAL_UNIT}`,
    ]);
  });

  it("CONTROL: the same event succeeds once actingUnitId matches the admission's real unit", () => {
    const seeded = seedWardFlowState();
    const after = wardFlowReducer(seeded, {
      type: "SET_DISCHARGE_BARRIER",
      role: "ward",
      now: NOW,
      actingUnitId: REAL_UNIT,
      admissionId: ADMISSION,
      barrier: "NDIS",
    });
    const reasons = added(seeded, after);
    expect(reasons).not.toContain(
      `SET_DISCHARGE_BARRIER was raised acting as unit ${WRONG_UNIT} but admission ${ADMISSION} is at ${REAL_UNIT}`,
    );
    expect(reasons).toEqual([]);
    expect(after.admissions.find((a) => a.id === ADMISSION)?.dischargeBarrier).toBe("NDIS");
  });
});

describe("RECORD_LEGAL_FORM_CONTINUATION: unrecognised form code (line 8085)", () => {
  const MOVEMENT = "WF-001";

  it("refuses a form code that is not in LEGAL_CLOCK_FORM_CODES", () => {
    const seeded = seedWardFlowState();
    const off = wardFlowReducer(seeded, {
      type: "RECORD_LEGAL_FORM_CONTINUATION",
      role: "coordinator",
      now: NOW,
      movementId: MOVEMENT,
      formCode: OFF_LIST,
      startedAt: NOW,
    });
    expect(added(seeded, off)).toEqual([`Form ${OFF_LIST} is not a recognised legal form in this prototype`]);
  });

  it("CONTROL: a form code the clock recognises is accepted", () => {
    const seeded = seedWardFlowState();
    const on = wardFlowReducer(seeded, {
      type: "RECORD_LEGAL_FORM_CONTINUATION",
      role: "coordinator",
      now: NOW,
      movementId: MOVEMENT,
      formCode: "1A",
      startedAt: NOW,
    });
    const reasons = added(seeded, on);
    expect(reasons).not.toContain(`Form ${OFF_LIST} is not a recognised legal form in this prototype`);
    expect(reasons).toEqual([]);
    expect(on.movements.find((m) => m.id === MOVEMENT)?.legalForm?.code).toBe("1A");
  });
});

describe("RAISE_EXPECT_FLAG: unlisted kind (line 8224)", () => {
  const MOVEMENT = "WF-001";

  it("refuses a kind that is neither voluntary_48h nor involuntary_7d", () => {
    const seeded = seedWardFlowState();
    const movement = seeded.movements.find((m) => m.id === MOVEMENT);
    expect(movement?.expectFlag, "this fixture already carries an expect flag — pick another").toBeUndefined();

    const off = wardFlowReducer(seeded, {
      type: "RAISE_EXPECT_FLAG",
      role: "coordinator",
      now: NOW,
      movementId: MOVEMENT,
      kind: OFF_LIST as never,
    });
    expect(added(seeded, off)).toEqual([`RAISE_EXPECT_FLAG kind must be "voluntary_48h" or "involuntary_7d"`]);
  });

  it("CONTROL: a recognised kind is accepted", () => {
    const seeded = seedWardFlowState();
    const on = wardFlowReducer(seeded, {
      type: "RAISE_EXPECT_FLAG",
      role: "coordinator",
      now: NOW,
      movementId: MOVEMENT,
      kind: "voluntary_48h",
    });
    const reasons = added(seeded, on);
    expect(reasons).not.toContain(`RAISE_EXPECT_FLAG kind must be "voluntary_48h" or "involuntary_7d"`);
    expect(reasons).toEqual([]);
    expect(on.movements.find((m) => m.id === MOVEMENT)?.expectFlag?.kind).toBe("voluntary_48h");
  });
});

// OVERRIDE_LEGAL_MISMATCH was removed on 2026-09-25 (owner ruling, Josh "all yes": ward authorisation
// for an involuntary patient is never overridable), and its refusal-gap tests with it. Kept on
// backup/2026-09-25-legal-mismatch-override.
