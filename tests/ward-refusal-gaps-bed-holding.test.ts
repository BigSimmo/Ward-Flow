// tests/ward-refusal-gaps-bed-holding.test.ts
//
// REFUSALS NO TEST HAD EVER REACHED — holding a bed: the waitlist cap, a second pull onto a ward
// with no one-to-one staff left, and releasing a bed while reopening the search.
//
// From the full coverage measurement of 25 September (`docs/ward-flow/journey/refusal-coverage.json`).
// Every case below reaches its refusal by real events from the seed, and carries a CONTROL: the
// same event from the same state with the one condition made valid, asserting the refusal is absent.
//
// ⚠️ FOUR MORE LINES IN THIS AREA WERE NOT REACHED, AND ARE NOT FORCED HERE:
//   - PATIENT_ARRIVED "has no accepted destination unit" and RELEASE_PULL "has no accepted unit
//     holding a bed" sit behind stage checks (moving / pulled). A movement reaches those stages
//     only through PULL_PATIENT, which requires `acceptedUnitId` to equal the unit it pulls at, and
//     every writer that clears `acceptedUnitId` either closes the movement or moves it back to
//     placement requested or destination review. Inferred from reading the reducer, not proven.
//   - PULL_PATIENT "points at admission …, which is not a bed held at …" needs a held admission at a
//     unit other than the accepted one; no route to that was found (ACCEPT_IN_PRINCIPLE refuses a
//     movement already accepted elsewhere).
//   - PULL_PATIENT's high-acuity refusal on a second pull needs a high-acuity patient holding a bed;
//     the seed holds none, so reaching it needs a new referral walked to a pull. Reachable in
//     principle; not written.
import { describe, expect, it } from "vitest";

import {
  heldBedRefusal,
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "@/components/ward-management/ward-flow-reducer";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import { movementUmrn } from "@/components/ward-management/ward-patient-resolver";
import { OVERRIDE_REASONS, RELEASE_PULL_REASONS } from "@/components/ward-management/ward-change-reasons";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { communityTeamOptions } from "@/components/ward-management/referrals/referral-destination-options";

const NOW = NOW_ANCHOR;
const OFF_LIST = "not-a-value-this-model-knows";

function added(before: WardFlowState, after: WardFlowState) {
  return after.rejections.slice(before.rejections.length).map((rejection) => rejection.reason);
}

/** Applies each event and fails loudly if the walk itself is refused, so no case rests on a broken fixture. */
function walk(state: WardFlowState, events: Array<Record<string, unknown>>): WardFlowState {
  let current = state;
  for (const event of events) {
    const before = current;
    current = wardFlowReducer(current, event as never);
    expect(added(before, current), `the fixture walk was refused at ${String(event.type)}`).toEqual([]);
  }
  return current;
}

describe("DECLINE refuses to waitlist a movement at more wards than the cap", () => {
  // WF-001 is waitlisted at two wards (a "no bed" decline waitlists rather than declines), then
  // referred to a third. The cap is three, so the third waitlist is ordinarily allowed; lowering
  // the cap to two — which a coordinator may do — is what makes the third one over the cap.
  function waitlistedTwiceAndReferredThird() {
    let t = NOW;
    const steps: Array<Record<string, unknown>> = [];
    for (const unitId of ["rph-adult-secure", "scgh-adult-open"]) {
      steps.push({ type: "REFER_TO_UNITS", role: "coordinator", now: ++t, movementId: "WF-001", unitIds: [unitId] });
      steps.push({ type: "DECLINE", role: "ward", now: ++t, movementId: "WF-001", unitId, reason: "no_bed" });
    }
    steps.push({
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: ++t,
      movementId: "WF-001",
      unitIds: ["arm-adult-open"],
    });
    return walk(seedWardFlowState(), steps);
  }

  const thirdWaitlist = {
    type: "DECLINE",
    role: "ward",
    now: NOW + 50,
    movementId: "WF-001",
    unitId: "arm-adult-open",
    reason: "no_bed",
  } as never;
  const message = `movement ${movementUmrn("WF-001", seedWardFlowState())} is already waitlisted at 2 wards; release one before waitlisting another`;

  it("refuses a third waitlist once the cap is two", () => {
    const capped = walk(waitlistedTwiceAndReferredThird(), [
      {
        type: "SET_CONFIGURATION",
        role: "coordinator",
        now: NOW + 40,
        payload: { edAccessTargetMinutes: 1440, parallelReferralCap: 2, pullHoldMinutes: 240 },
      },
    ]);
    expect(added(capped, wardFlowReducer(capped, thirdWaitlist))).toEqual([message]);
  });

  it("CONTROL: the same third waitlist is accepted under the default cap of three", () => {
    const uncapped = waitlistedTwiceAndReferredThird();
    expect(uncapped.configuration.parallelReferralCap).toBe(3);
    expect(added(uncapped, wardFlowReducer(uncapped, thirdWaitlist))).toEqual([]);
  });
});

describe("PULL_PATIENT refuses to restore a held bed when the ward has no one-to-one staff left", () => {
  // WF-011 needs one-to-one specialling and holds a bed at fre-older-adult, which can staff one.
  // WF-002, who also needs specialling, is placed and arrives there, using that one place. WF-011
  // is then stepped back and pulled again: the restore path does not count WF-011's own bed, and
  // finds nobody left to staff it.
  const U = "fre-older-adult";
  function fullWardAndSteppedBack() {
    let t = NOW;
    return walk(seedWardFlowState(), [
      { type: "REFER_TO_UNITS", role: "coordinator", now: ++t, movementId: "WF-002", unitIds: [U] },
      { type: "ACCEPT_IN_PRINCIPLE", role: "ward", now: ++t, movementId: "WF-002", unitId: U, actingUnitId: U },
      { type: "PULL_PATIENT", role: "ward", now: ++t, movementId: "WF-002", unitId: U, actingUnitId: U },
      { type: "RECORD_TRANSPORT_NEED", role: "ed", now: ++t, movementId: "WF-002", needed: false },
      { type: "PATIENT_ARRIVED", role: "ward", now: ++t, movementId: "WF-002", actingUnitId: U },
      {
        type: "STEP_BACK_STAGE",
        role: "coordinator",
        now: ++t,
        movementId: "WF-011",
        to: "accepted_awaiting_bed",
        reason: "recorded_in_error",
      },
    ]);
  }
  const repull = {
    type: "PULL_PATIENT",
    role: "ward",
    now: NOW + 20,
    movementId: "WF-011",
    unitId: U,
    actingUnitId: U,
  };

  it("refuses the second pull with no override reason", () => {
    const state = fullWardAndSteppedBack();
    expect(added(state, wardFlowReducer(state, repull as never))).toEqual([
      "Wardong (Ward 4.3) has no one-to-one specialling capacity left; this patient needs specialling and the ward cannot staff another",
    ]);
  });

  it("CONTROL: the same second pull is accepted once an override reason is recorded", () => {
    const state = fullWardAndSteppedBack();
    const after = wardFlowReducer(state, { ...repull, overrideReason: OVERRIDE_REASONS[0] } as never);
    expect(added(state, after)).toEqual([]);
    expect(after.movements.find((m) => m.id === "WF-011")?.stage).toBe("pulled");
  });
});

describe("RELEASE_AND_REOPEN_SEARCH refuses an unlisted reason and a ward acting for another ward", () => {
  // WF-004 holds a bed at bty-adult-secure with no transport booked — the state this act is for.
  const heldAt = "bty-adult-secure";
  const release = {
    type: "RELEASE_AND_REOPEN_SEARCH",
    role: "coordinator",
    now: NOW + 5,
    movementId: "WF-004",
    reason: RELEASE_PULL_REASONS[0],
  };

  it("refuses a reason that is not in RELEASE_PULL_REASONS, and not a listed one", () => {
    const seeded = seedWardFlowState();
    expect(added(seeded, wardFlowReducer(seeded, { ...release, reason: OFF_LIST } as never))).toEqual([
      "RELEASE_AND_REOPEN_SEARCH reason must be chosen from RELEASE_PULL_REASONS",
    ]);
    expect(added(seeded, wardFlowReducer(seeded, release as never))).toEqual([]);
  });

  it("refuses a ward acting as a different unit, and not the ward that holds the bed", () => {
    const seeded = seedWardFlowState();
    const asWard = { ...release, role: "ward" };
    expect(added(seeded, wardFlowReducer(seeded, { ...asWard, actingUnitId: "rph-adult-secure" } as never))).toEqual([
      `RELEASE_AND_REOPEN_SEARCH was raised acting as unit rph-adult-secure but movement ${movementUmrn("WF-004", seeded)}'s bed is at ${heldAt}`,
    ]);
    expect(added(seeded, wardFlowReducer(seeded, { ...asWard, actingUnitId: heldAt } as never))).toEqual([]);
  });
});

describe("heldBedNumber is cleared when acceptance is unwound or overwritten", () => {
  function freeBedNumber(state: WardFlowState, unitId: string): number {
    const unit = state.units.find((u) => u.id === unitId)!;
    const taken = new Set(
      state.admissions
        .filter((a) => a.unitId === unitId && a.state !== "departed" && a.bedNumber !== undefined)
        .map((a) => a.bedNumber),
    );
    for (let b = 1; b <= unit.beds; b++) {
      if (!taken.has(b)) return b;
    }
    throw new Error(`no free bed number on ${unitId}`);
  }

  it("clears heldBedNumber on WITHDRAW_ACCEPTANCE and does not carry a stale bed number into a later ACCEPT_IN_PRINCIPLE", () => {
    const seeded = seedWardFlowState();
    const bed = freeBedNumber(seeded, "scgh-adult-open");
    let t = NOW;
    const after = walk(seeded, [
      {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        now: ++t,
        movementId: "WF-001",
        unitIds: ["scgh-adult-open", "arm-adult-open"],
      },
      {
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        now: ++t,
        movementId: "WF-001",
        unitId: "scgh-adult-open",
        actingUnitId: "scgh-adult-open",
        bedNumber: bed,
      },
    ]);
    expect(after.movements.find((m) => m.id === "WF-001")?.heldBedNumber).toBe(bed);

    const withdrawn = walk(after, [
      {
        type: "WITHDRAW_ACCEPTANCE",
        role: "coordinator",
        now: ++t,
        movementId: "WF-001",
        reason: "recorded_in_error",
      },
    ]);
    expect(withdrawn.movements.find((m) => m.id === "WF-001")?.heldBedNumber).toBeUndefined();

    const reaccepted = walk(withdrawn, [
      { type: "REFER_TO_UNITS", role: "coordinator", now: ++t, movementId: "WF-001", unitIds: ["arm-adult-open"] },
      {
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        now: ++t,
        movementId: "WF-001",
        unitId: "arm-adult-open",
        actingUnitId: "arm-adult-open",
      },
    ]);
    expect(reaccepted.movements.find((m) => m.id === "WF-001")?.heldBedNumber).toBeUndefined();
  });

  it("clears heldBedNumber on RELEASE_AND_REOPEN_SEARCH and RECORD_ED_MEDICAL_DETERIORATION", () => {
    const seeded = seedWardFlowState();
    const bed = freeBedNumber(seeded, "scgh-adult-open");
    let t = NOW;
    const accepted = walk(seeded, [
      { type: "REFER_TO_UNITS", role: "coordinator", now: ++t, movementId: "WF-001", unitIds: ["scgh-adult-open"] },
      {
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        now: ++t,
        movementId: "WF-001",
        unitId: "scgh-adult-open",
        actingUnitId: "scgh-adult-open",
        bedNumber: bed,
      },
    ]);
    expect(accepted.movements.find((m) => m.id === "WF-001")?.heldBedNumber).toBe(bed);

    const reopened = walk(accepted, [
      {
        type: "RELEASE_AND_REOPEN_SEARCH",
        role: "coordinator",
        now: ++t,
        movementId: "WF-001",
        actingUnitId: "scgh-adult-open",
        reason: RELEASE_PULL_REASONS[0],
      },
    ]);
    expect(reopened.movements.find((m) => m.id === "WF-001")?.heldBedNumber).toBeUndefined();

    const originEdId = accepted.movements.find((m) => m.id === "WF-001")!.originEdId;
    const deteriorated = walk(accepted, [
      {
        type: "RECORD_ED_MEDICAL_DETERIORATION",
        role: "ed",
        now: ++t,
        movementId: "WF-001",
        actingPlaceId: originEdId,
      },
    ]);
    expect(deteriorated.movements.find((m) => m.id === "WF-001")?.heldBedNumber).toBeUndefined();
  });
  it.each([
    ["RELEASE_AND_REOPEN_SEARCH", "RELEASE_AND_REOPEN_SEARCH"],
    ["RECORD_ED_OUTCOME", "RECORD_ED_OUTCOME"],
    ["WITHDRAW_REFERRAL", "WITHDRAW_REFERRAL"],
    ["REFER_TO_COMMUNITY_TEAM", "REFER_TO_COMMUNITY_TEAM"],
  ] as const)("frees the bed the linked referral arm held when %s releases it", (_name, release) => {
    const seeded = seedWardFlowState();
    const unitId = "scgh-adult-open";
    const bed = freeBedNumber(seeded, unitId);
    let t = NOW;
    const accepted = walk(seeded, [
      { type: "REFER_TO_UNITS", role: "coordinator", now: ++t, movementId: "WF-001", unitIds: [unitId] },
      {
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        now: ++t,
        movementId: "WF-001",
        unitId,
        actingUnitId: unitId,
        bedNumber: bed,
      },
    ]);
    // A synthetic referral whose accepted ward arm holds the same bed, linked to the movement.
    const template = seeded.referrals[0]!;
    const arm = template.destinations[0]!;
    const linked: WardFlowState = {
      ...accepted,
      referrals: [
        ...accepted.referrals,
        {
          ...template,
          id: "RF-0991",
          destinations: [
            {
              ...arm,
              state: "accepted",
              destination: { kind: "psychiatric_ward", unitId },
              acceptedUnitId: unitId,
              heldBedNumber: bed,
            },
          ],
        } as WardFlowState["referrals"][number],
      ],
      movements: accepted.movements.map((m) =>
        m.id !== "WF-001"
          ? m
          : release === "REFER_TO_COMMUNITY_TEAM"
            ? // A community referral needs a voluntary patient or a conclusive examination.
              { ...m, referralId: "RF-0991", legalForm: undefined, legalStatus: "Voluntary" as const }
            : { ...m, referralId: "RF-0991" },
      ),
    };
    const unit = linked.units.find((u) => u.id === unitId)!;
    expect(heldBedRefusal(linked, unit, bed)).not.toBeNull();

    const reopened = walk(linked, [
      release === "RELEASE_AND_REOPEN_SEARCH"
        ? {
            type: "RELEASE_AND_REOPEN_SEARCH",
            role: "coordinator",
            now: ++t,
            movementId: "WF-001",
            actingUnitId: unitId,
            reason: RELEASE_PULL_REASONS[0],
          }
        : release === "RECORD_ED_OUTCOME"
          ? {
              type: "RECORD_ED_OUTCOME",
              role: "ed",
              now: ++t,
              movementId: "WF-001",
              outcome: "for_community_follow_up",
            }
          : release === "WITHDRAW_REFERRAL"
            ? { type: "WITHDRAW_REFERRAL", role: "coordinator", now: ++t, movementId: "WF-001" }
            : {
                type: "REFER_TO_COMMUNITY_TEAM",
                role: "coordinator",
                now: ++t,
                movementId: "WF-001",
                team: communityTeamOptions()[0]!,
              },
    ]);
    expect(reopened.rejections).toHaveLength(linked.rejections.length);
    expect(reopened.referrals.find((r) => r.id === "RF-0991")?.destinations[0]?.heldBedNumber).toBeUndefined();
    expect(heldBedRefusal(reopened, unit, bed)).toBeNull();
  });
});

describe("RECORD_ADMISSION_CARE (transfer.arrived) strips sending-ward bedNumber and resets discharge fields", () => {
  it("omits bedNumber and clears dischargeCriteria, dischargeBarrier, and stepDownCandidate on the receiving admission", () => {
    const state = seedWardFlowState();
    const candidate = state.admissions.find((a) => a.state === "occupied" && a.patientId)!;
    const base = state.movements.find((m) => m.cohort === state.units.find((u) => u.id === candidate.unitId)?.cohort)!;
    base.admissionId = candidate.id;
    base.patientId = candidate.patientId!;
    base.stage = "arrived";
    base.acceptedUnitId = candidate.unitId;
    candidate.movementId = base.id;
    state.units = state.units.map((u) => ({
      ...u,
      allocatable: { ...u.allocatable, confirmedAt: NOW },
      empty: { ...u.empty, confirmedAt: NOW },
    }));
    const receivingUnit = state.units.find(
      (u) => u.id !== candidate.unitId && eligibility(base, u, NOW).eligible && u.allocatableLocked > 0,
    )!;
    expect(receivingUnit).toBeDefined();

    let t = NOW;
    const withSendingFields: WardFlowState = {
      ...state,
      admissions: state.admissions.map((a) =>
        a.id === candidate.id
          ? {
              ...a,
              bedNumber: 1,
              dischargeBarrier: "Accommodation / Housing",
              dischargeCriteria: {
                setAt: t,
                items: [{ criterion: "Accommodation confirmed", metAt: null }],
              },
              stepDownCandidate: true,
            }
          : a,
      ),
    };
    const baseRev = withSendingFields.dischargeRevisions[candidate.id] ?? 0;
    const gen = withSendingFields.worldGeneration;

    const transferred = walk(withSendingFields, [
      {
        type: "RECORD_ADMISSION_CARE",
        role: "coordinator",
        now: ++t,
        admissionId: candidate.id,
        patientId: candidate.patientId,
        expectedGeneration: gen,
        expectedRevision: baseRev,
        change: { kind: "transfer", receivingUnitId: receivingUnit.id, step: "accepted" },
      },
      {
        type: "RECORD_ADMISSION_CARE",
        role: "coordinator",
        now: ++t,
        admissionId: candidate.id,
        patientId: candidate.patientId,
        expectedGeneration: gen,
        expectedRevision: baseRev + 1,
        change: { kind: "transfer", receivingUnitId: receivingUnit.id, step: "handover" },
      },
      {
        type: "RECORD_ADMISSION_CARE",
        role: "coordinator",
        now: ++t,
        admissionId: candidate.id,
        patientId: candidate.patientId,
        expectedGeneration: gen,
        expectedRevision: baseRev + 2,
        change: { kind: "transfer", receivingUnitId: receivingUnit.id, step: "arrived" },
      },
    ]);

    const departedSending = transferred.admissions.find((a) => a.id === candidate.id)!;
    expect(departedSending.state).toBe("departed");
    expect(departedSending.dischargeCriteria).toBeNull();

    const receivingAdmission = transferred.admissions.find(
      (a) => a.id.startsWith(`transfer-${candidate.id}-`) && a.unitId === receivingUnit.id,
    )!;
    expect(receivingAdmission).toBeDefined();
    expect("bedNumber" in receivingAdmission).toBe(false);
    expect(receivingAdmission.bedNumber).toBeUndefined();
    expect(receivingAdmission.dischargeBarrier).toBeNull();
    expect(receivingAdmission.dischargeCriteria).toBeNull();
    expect(receivingAdmission.stepDownCandidate).toBe(false);
  });
});
