import { describe, expect, it } from "vitest";

import { deriveEdScreen } from "@/components/ward-management/ed/ed-screen-derivations";
import {
  acceptedReferralsAwaitingPull,
  recordedPullDetails,
} from "@/components/ward-management/referrals/accepted-ward-referral";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { Referral } from "@/components/ward-management/ward-model";
import { observationAt } from "@/components/ward-management/ward-observation";
import { acceptedAddressing } from "@/components/ward-management/ward-referrals";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Walk-through 26 Oct 2026, synthetic seed only.
 * WT-04: a sent ED bed request shows on the ED board before any journey, and the journey keeps the
 * time already waited. WT-30: the journey's stage history uses the recorded request and acceptance
 * times. WT-05: recorded sex is asked once at Add patient. WT-06: the referral's chosen legal form
 * and the ED referrer's clearance answer carry forward to Pull the bed.
 */
/** RF-008 (synthetic seed, accepted at a ward with no journey) sent instead by RPH ED medical staff. */
function edReferralAwaitingPull(seeded: WardFlowState) {
  const state = withReferral(seeded, "RF-008", (referral) => ({ ...referral, source: "ed_medical" }));
  const item = acceptedReferralsAwaitingPull(state.referrals, state.units, state.movements).find(
    ({ referral }) => referral.id === "RF-008",
  );
  expect(item).toBeDefined();
  const ed = allEmergencyDepartments().find((place) => place.siteCode === item!.referral.originSiteCode);
  expect(ed).toBeDefined();
  return { ...item!, edId: ed!.id, state };
}

function pullEvent(referral: Referral, unitId: string, edId: string): WardFlowEvent {
  const destination = acceptedAddressing(referral)!.destination;
  if (destination.kind !== "psychiatric_ward") throw new Error("seed referral was not accepted at a ward");
  return {
    type: "RAISE_REFERRAL",
    role: "coordinator",
    now: NOW_ANCHOR,
    edId,
    referralId: referral.id,
    acceptedUnitId: unitId,
    draft: {
      cohort: referral.ageBand!,
      security: destination.secureBedNeeded ? "Secure" : "Open",
      sex: destination.sex,
      gender: destination.gender,
      highAcuity: destination.highAcuityNursingNeeded === true,
      observation: observationAt("general"),
      legalStatus: "Voluntary",
      legalFormCode: null,
      urgency: referral.urgency,
      atsCategory: referral.atsCategory,
    },
  };
}

function withReferral(state: WardFlowState, id: string, change: (referral: Referral) => Referral): WardFlowState {
  return { ...state, referrals: state.referrals.map((referral) => (referral.id === id ? change(referral) : referral)) };
}

function edBoard(state: WardFlowState, edId: string) {
  const noop = () => undefined;
  return deriveEdScreen({
    movements: state.movements,
    units: state.units,
    referrals: state.referrals,
    registryPatients: state.patients,
    configuration: state.configuration,
    inboxSnoozes: state.inboxSnoozes,
    admissions: state.admissions,
    now: NOW_ANCHOR,
    accessTarget: 240,
    thisEdId: edId,
    boardFilter: "all",
    patientQuery: "",
    patientSort: "current",
    heroHighlight: null,
    selectedPatientId: null,
    arrivalPlanOpenFor: undefined,
    setSelectedPatientId: noop,
    setPhoneSheetFor: noop,
    setArrivalPlanOpenFor: noop,
    toggleBookTransport: noop,
    recordEdStep: noop,
  });
}

describe("walk-through carry-forward (WT-04, WT-05, WT-06, WT-30)", () => {
  it("lists a sent ED bed request on that ED's board until a journey starts from it (WT-04)", () => {
    const { referral, unitId, edId, state: seeded } = edReferralAwaitingPull(seedWardFlowState());
    const sent = edBoard(seeded, edId).sentForBed.find((row) => row.id === referral.id);
    expect(sent).toBeDefined();
    expect(sent!.sentAt).toBe(referral.raisedAt);
    expect(sent!.wards.some((ward) => ward.state === "accepted, bed not pulled yet")).toBe(true);

    const pulled = wardFlowReducer(seeded, pullEvent(referral, unitId, edId));
    expect(pulled.rejections).toEqual(seeded.rejections);
    expect(pulled.movements.some((movement) => movement.referralId === referral.id)).toBe(true);
    expect(edBoard(pulled, edId).sentForBed.some((row) => row.id === referral.id)).toBe(false);
  });

  it("opens the journey at the recorded referral time and keeps the recorded stage times (WT-04, WT-30)", () => {
    const { referral, unitId, edId, state: seeded } = edReferralAwaitingPull(seedWardFlowState());
    const next = wardFlowReducer(seeded, pullEvent(referral, unitId, edId));
    const journey = next.movements.find((movement) => movement.referralId === referral.id)!;
    const expectedOpen = Math.min(
      referral.inDepartmentAt ?? referral.triagedAt ?? referral.raisedAt,
      referral.raisedAt,
    );
    expect(journey.openedAt).toBe(expectedOpen);
    expect(journey.openedAt).toBeLessThan(NOW_ANCHOR);
    expect(journey.stageChanges[0]).toMatchObject({ at: expectedOpen, to: "placement_requested" });
    const accepted = journey.stageChanges.find((change) => change.to === "accepted_awaiting_bed");
    expect(accepted?.at).toBe(acceptedAddressing(referral)!.decidedAt);
  });

  it("carries the ED referrer's clearance answer when nothing was recorded since (WT-06)", () => {
    const { referral, unitId, edId, state: seeded } = edReferralAwaitingPull(seedWardFlowState());
    const state = withReferral(seeded, referral.id, (current) => ({
      ...current,
      medicalClearance: undefined,
      intake: { ...(current.intake ?? {}), medicalClearance: { cleared: true } } as Referral["intake"],
    }));
    const next = wardFlowReducer(state, pullEvent(referral, unitId, edId));
    const journey = next.movements.find((movement) => movement.referralId === referral.id)!;
    expect(journey.medicalClearance).toEqual({ cleared: true, at: referral.raisedAt });
  });

  it("prefills the legal form the referral chose, and works out no status from it (WT-06)", () => {
    const { referral } = edReferralAwaitingPull(seedWardFlowState());
    const withForm = { ...referral, intake: { ...(referral.intake ?? {}), legalStatus: "Form 1A" } } as Referral;
    const details = recordedPullDetails(withForm, []);
    expect(details.legalFormCode).toBe("1A");
    expect(details.legalStatus).toBeUndefined();
    const voluntary = { ...referral, intake: { ...(referral.intake ?? {}), legalStatus: "Voluntary" } } as Referral;
    expect(recordedPullDetails(voluntary, [])).toMatchObject({ legalStatus: "Voluntary", fromEdBoard: false });
    expect(recordedPullDetails(voluntary, []).legalFormCode).toBeUndefined();
  });

  it("records sex once at Add patient, and refuses a value outside the list (WT-05)", () => {
    const state = seedWardFlowState();
    const add = (sex: string): WardFlowEvent => ({
      type: "ADD_PATIENT",
      role: "ed",
      now: NOW_ANCHOR,
      umrn: `UM9${sex.length}0001`,
      givenName: "Synthetic",
      familyName: "Walkthrough",
      dateOfBirth: "1990-01-02",
      gender: "Female",
      sex,
    });
    const added = wardFlowReducer(state, add("Female"));
    expect(added.patients.at(-1)).toMatchObject({ sex: "Female", gender: "Female" });
    for (const refused of ["Not recorded", "Unknown"]) {
      const next = wardFlowReducer(state, add(refused));
      expect(next.patients).toHaveLength(state.patients.length);
      expect(next.rejections.at(-1)?.reason).toMatch(/sex must be chosen/u);
    }
  });
});
