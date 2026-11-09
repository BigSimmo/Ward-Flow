// Feature 39 (9 Nov 2026): a new referral for someone with a current stay or an earlier referral
// starts from that record's STRUCTURED facts only, each with a note naming its source. Free text
// and risk flags always start empty (Josh, 25 Sep 2026, "Real details").

import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import type { Admission } from "../src/components/ward-management/ward-admissions";
import type { Movement, Referral } from "../src/components/ward-management/ward-model";
import {
  carriedNoteFor,
  carryNote,
  referralCarryOver,
  type CarryOverRecord,
} from "../src/components/ward-management/referrals/referral-carry-over";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const DAY_ZERO = new Date("2026-11-09T00:00:00+08:00");
const PERSON = "PT-SYNTH-CARRY";

function baseRecord(): CarryOverRecord {
  const state = seedWardFlowState();
  return {
    admissions: state.admissions,
    movements: state.movements,
    // A synthetic person on file, so the resolver can name the stay's occupant.
    patients: [...state.patients, { ...state.patients[0]!, id: PERSON }],
    referrals: state.referrals,
    units: state.units,
    dayZero: DAY_ZERO,
  };
}

function syntheticReferral(raisedAt: number, overrides: Partial<Referral> = {}): Referral {
  const template = seedWardFlowState().referrals.find((referral) => referral.intake)!;
  return {
    ...template,
    id: `RF-SYNTH-${raisedAt}`,
    patientId: PERSON,
    raisedAt,
    ageBand: "Adult",
    homeRegion: template.homeRegion ?? "Perth Metropolitan",
    history: "Typed history that must never carry over",
    destinations: [
      {
        state: "queued",
        destination: {
          kind: "psychiatric_ward",
          unitId: "rph-adult-secure",
          sex: "Female",
          gender: "Female",
          secureBedNeeded: true,
          involuntaryBedNeeded: true,
          highAcuityNursingNeeded: true,
        },
      },
    ],
    intake: {
      ...template.intake!,
      legalStatus: "Form 6A",
      reasonForReferral: "Typed reason that must never carry over",
      riskFlags: ["aggression", "suicide"],
      needs: { kind: "community", interpreter: true, carerContact: false },
    },
    ...overrides,
  } as Referral;
}

function stayFor(record: CarryOverRecord, arrivedAt: number): { admission: Admission; movement: Movement } {
  const template = record.admissions.find((admission) => admission.state === "occupied")!;
  const movementTemplate = record.movements[0]!;
  const movement: Movement = {
    ...movementTemplate,
    id: "WF-SYNTH-CARRY",
    patientId: PERSON,
    legalStatus: "Involuntary inpatient",
    legalForm: {
      ...(movementTemplate.legalForm ?? {}),
      code: "6B",
      dueAt: arrivedAt + 60 * 24 * 10,
    } as Movement["legalForm"],
    admissionId: "AD-SYNTH-CARRY",
  };
  const admission: Admission = {
    ...template,
    id: "AD-SYNTH-CARRY",
    patientId: PERSON,
    movementId: movement.id,
    state: "occupied",
    arrivedAt,
    highAcuity: false,
  } as Admission;
  return { admission, movement };
}

describe("referral carry-over (feature 39)", () => {
  it("carries nothing for a person with no stay and no earlier referral", () => {
    expect(referralCarryOver(PERSON, baseRecord(), NOW_ANCHOR)).toEqual({});
    expect(referralCarryOver(undefined, baseRecord(), NOW_ANCHOR)).toEqual({});
  });

  it("carries only structured facts from the last referral, with a dated note", () => {
    const record = baseRecord();
    const older = syntheticReferral(-60 * 24 * 9, { homeRegion: undefined });
    const latest = syntheticReferral(-60 * 24 * 6);
    const carry = referralCarryOver(PERSON, { ...record, referrals: [...record.referrals, older, latest] }, NOW_ANCHOR);
    expect(carry.legalStatus).toEqual({
      value: "Form 6A",
      from: "referral",
      note: carryNote("referral", latest.raisedAt, DAY_ZERO),
    });
    expect(carry.legalStatus?.note).toMatch(/^From last referral \d{1,2} [A-Z][a-z]{2}$/);
    expect(carry.security?.value).toBe("Secure");
    expect(carry.highAcuity?.value).toBe(true);
    expect(carry.ageBand?.value).toBe("Adult");
    expect(carry.interpreter?.value).toBe(true);
    expect(carry.carerContact?.value).toBe(false);
    // No expiry without a recorded form date on the referral.
    expect(carry.legalExpiry).toBeUndefined();
    // Free text and risk flags are never carried: the result has no field for them at all.
    const keys = Object.keys(carry);
    for (const forbidden of ["provisionalDiag", "doctorNote", "clinicalSummary", "history", "riskFlags", "reason"]) {
      expect(keys).not.toContain(forbidden);
    }
    expect(JSON.stringify(carry)).not.toMatch(/Typed|aggression|suicide/);
  });

  it("does not carry an unrecorded legal status", () => {
    const record = baseRecord();
    const referral = syntheticReferral(-100);
    const unrecorded = { ...referral, intake: { ...referral.intake!, legalStatus: "Not recorded" } };
    expect(referralCarryOver(PERSON, { ...record, referrals: [unrecorded] }, NOW_ANCHOR).legalStatus).toBeUndefined();
  });

  it("the current stay's legal status wins over an older referral", () => {
    const record = baseRecord();
    const { admission, movement } = stayFor(record, -60 * 24 * 2);
    const older = syntheticReferral(-60 * 24 * 5);
    const carry = referralCarryOver(
      PERSON,
      {
        ...record,
        admissions: [...record.admissions, admission],
        movements: [...record.movements, movement],
        referrals: [...record.referrals, older],
      },
      NOW_ANCHOR,
    );
    expect(carry.legalStatus).toEqual({ value: "Form 6B", from: "stay", note: "From current stay" });
    expect(carry.legalExpiry?.from).toBe("stay");
    expect(carry.legalExpiry?.value).toMatch(/clinician-entered$/);
    expect(carry.highAcuity).toEqual({ value: false, from: "stay", note: "From current stay" });
    // Bed security follows the same rule, from the movement that brought the stay (review, 9 Nov 2026).
    expect(carry.security?.from).toBe("stay");
    // Facts only the referral holds still come from it, marked as such.
    expect(carry.interpreter?.from).toBe("referral");
  });

  it("a referral raised during the stay is the newer record", () => {
    const record = baseRecord();
    const { admission, movement } = stayFor(record, -60 * 24 * 2);
    const newer = syntheticReferral(-60);
    const carry = referralCarryOver(
      PERSON,
      {
        ...record,
        admissions: [...record.admissions, admission],
        movements: [...record.movements, movement],
        referrals: [...record.referrals, newer],
      },
      NOW_ANCHOR,
    );
    expect(carry.legalStatus?.value).toBe("Form 6A");
    expect(carry.legalStatus?.from).toBe("referral");
    expect(carry.legalExpiry).toBeUndefined();
  });

  it("shows a note only while the field still holds the carried value", () => {
    const fact = { value: "Form 6A", from: "referral" as const, note: "From last referral 3 Nov" };
    expect(carriedNoteFor(fact, "Form 6A")).toBe("From last referral 3 Nov");
    expect(carriedNoteFor(fact, "Voluntary")).toBeNull();
    expect(carriedNoteFor(undefined, "Form 6A")).toBeNull();
  });
});
