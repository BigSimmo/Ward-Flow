import { describe, expect, it } from "vitest";

import { fitLine, fitLineText } from "@/components/ward-management/coordinator/shortlist-fit-line";
import {
  referralDraftBlockedReason,
  referralDraftMissingFields,
  type ReferralDraftAnswers,
} from "@/components/ward-management/ed/ed-blocked-reasons";
import { DEFAULT_DRAFT } from "@/components/ward-management/ed/ed-screen-model";
import { resolvePatientNowRecord } from "@/components/ward-management/patients/patient-now-adapter";
import { patientKeyFor } from "@/components/ward-management/referrals/ward-referral-drawer-model";
import { REVIEW_WINDOWS_UNSIGNED } from "@/components/ward-management/triage/triage-record";
import { recordLegalStatus } from "@/components/ward-management/triage/triage-risk-people";
import { FOLLOW_UP_WINDOWS_UNSIGNED } from "@/components/ward-management/triage/triage-risk-safety";
import { absenceInboxItems } from "@/components/ward-management/ward-absence-tasks";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NO_INTERVAL_ERROR } from "@/components/ward-management/ward-observation";
import { NO_INTERVAL_ERROR as CONTROL_NO_INTERVAL_ERROR } from "@/components/ward-management/ward/ward-observation-control";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardMovements } from "@/components/ward-management/ward-movements";

// The independent clinical review's must-fix items R1, R2, R7 and R9, and its questions 6 and 8
// (labels only). No clinical value changes here. Synthetic data only.

// What the screens draw (the live ED raise's interval, the ward home's Act now row, Triage's window
// marks and All wards' observation label) is checked rendered in ward-clinical-review-fixes-2.dom.test.tsx,
// ward-clinical-review-fixes-2-wards.dom.test.tsx and ward-clinical-triage-wording.dom.test.tsx, not
// by reading the source as text (CQ-10). The design-only redesign board's copy of the raise guard is
// in ward-clinical-source-guards.test.ts.

describe("R1: no Intermittent interval starts chosen on the ED raise (D-187 item 19)", () => {
  const complete: ReferralDraftAnswers = {
    patientFound: true,
    unidentified: false,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    gender: "Female",
    legalStatus: "Voluntary",
    urgency: 2,
    observation: "intermittent",
    observationIntervalMinutes: null,
    observationReviewTime: "",
    highAcuity: false,
    legalFormDueAtDate: "",
    legalFormDueAtTime: "",
  };

  it("starts the draft with no interval", () => {
    expect(DEFAULT_DRAFT.observationIntervalMinutes).toBeNull();
  });

  it("refuses Intermittent with no interval, in the observation control's words, and marks the question", () => {
    expect(NO_INTERVAL_ERROR).toBe("Choose how often to check: 15 or 30 minutes.");
    expect(CONTROL_NO_INTERVAL_ERROR).toBe(NO_INTERVAL_ERROR);
    expect(referralDraftBlockedReason(complete)).toBe(NO_INTERVAL_ERROR);
    expect(referralDraftMissingFields(complete)).toEqual(["observationInterval"]);
    const withoutInterval: ReferralDraftAnswers = { ...complete };
    delete withoutInterval.observationIntervalMinutes;
    expect(referralDraftBlockedReason(withoutInterval)).toBe(NO_INTERVAL_ERROR);
  });

  it("goes on once someone chooses an interval, and never asks for one on another level", () => {
    expect(referralDraftBlockedReason({ ...complete, observationIntervalMinutes: 30 })).toBeUndefined();
    expect(referralDraftMissingFields({ ...complete, observationIntervalMinutes: 30 })).toEqual([]);
    expect(referralDraftBlockedReason({ ...complete, observation: "general" })).toBeUndefined();
  });
});

describe('R2: a missing person no longer reads "order stays in force" (D-187 item 8)', () => {
  it("states only who is missing and since when on the task list", () => {
    const seed = seedWardFlowState();
    const stay = seed.admissions.find((admission) => admission.state === "occupied")!;
    const patient = seed.patients.find((candidate) => candidate.id === stay.patientId);
    const [item] = absenceInboxItems(
      {
        leaveBeds: [
          {
            id: "LB-SYN-R2",
            unitId: stay.unitId,
            admissionId: stay.id,
            expectedReturn: NOW_ANCHOR + 60,
            confirmedAt: NOW_ANCHOR - 30,
            confirmedBy: "Ward",
            absentWithoutLeave: { since: NOW_ANCHOR - 30, steps: [] },
          },
        ],
        admissions: [{ ...stay, movementId: null }],
        movements: [],
        patients: patient ? [{ ...patient, legalStatus: "Involuntary inpatient" }] : [],
        referrals: seed.referrals,
        units: allUnits(),
      },
      NOW_ANCHOR,
    );
    expect(item?.detail).toMatch(/^Missing from .+ since .+$/u);
    expect(item?.detail).not.toContain("order stays in force");
  });
});

describe("R7: the shortlist card names the authorisation check", () => {
  it("never folds a need-marked authorisation into a met security group", () => {
    const line = fitLine([
      { gate: "security", pass: true, detail: "" },
      { gate: "legal_status", pass: true, info: true, need: true, detail: "Involuntary admissions: not stated" },
      { gate: "age", pass: true, detail: "" },
    ]);
    expect(line).toEqual({ met: ["Security", "Age"], notMet: [], toConfirm: ["Authorisation"] });
    expect(fitLineText(line)).toBe("Fits security and age · Check authorisation");
  });

  it("says nothing about authorisation when the person needs no involuntary-capable bed", () => {
    const line = fitLine([
      { gate: "security", pass: true, detail: "" },
      { gate: "authorisation", pass: true, info: true, detail: "Involuntary admissions: not stated" },
    ]);
    expect(fitLineText(line)).toBe("Fits security");
  });

  it("reads Check authorisation for a person referred for examination on a real eligibility run", () => {
    const base = wardMovements[0]!;
    const unit = allUnits()[0]!;
    const { gates } = eligibility(
      { ...base, legalStatus: "Referred for psychiatric examination", declines: [] },
      unit,
      NOW_ANCHOR,
    );
    expect(gates.find((gate) => gate.gate === "authorisation")).toMatchObject({ need: true, info: true });
    const text = fitLineText(fitLine(gates)) ?? "";
    expect(text).toContain("Check authorisation");
    expect(text).not.toMatch(/Fits [^·]*authorisation/u);
  });
});

describe("R9: the Triage banner reads the patient page's legal status for everyone (D-186 item 10)", () => {
  const seed = seedWardFlowState();
  const withForm = seed.patients.flatMap((patient) => {
    const key = patientKeyFor(patient.id, seed);
    if (!key?.startsWith("WF-")) return [];
    const movement = seed.movements.find((candidate) => candidate.id === key);
    return movement?.legalForm ? [{ patient, key, movement }] : [];
  });

  it("finds people with an open movement that carries a form (not vacuous)", () => {
    expect(withForm.length).toBeGreaterThan(0);
  });

  it("shows the status as the status, never the form code, and matches the patient page", () => {
    for (const { key } of withForm) {
      const status = recordLegalStatus(key, seed, NOW_ANCHOR);
      const page = resolvePatientNowRecord(
        key,
        seed.patients,
        seed.movements,
        seed.referrals,
        seed.admissions,
        seed.units,
        NOW_ANCHOR,
      );
      expect(status, key).toBe(page?.legalNow.status ?? "Not recorded");
      expect(status, key).not.toMatch(/^Form /u);
    }
  });

  it('reads "Not recorded" for an address the record does not hold', () => {
    expect(recordLegalStatus("PT-SYN-NOBODY", seed, NOW_ANCHOR)).toBe("Not recorded");
  });
});

describe("Question 6: the triage follow-up and review windows carry the see-by window's mark", () => {
  it("is on while the windows are unsigned in the register, and changes no value", () => {
    expect(FOLLOW_UP_WINDOWS_UNSIGNED).toBe(
      [CLINICAL_VALUES.triageFollowUpSoon, CLINICAL_VALUES.triageFollowUpHint, CLINICAL_VALUES.triageFollowUpWeek].some(
        (entry: { status: string }) => entry.status !== "signed",
      ),
    );
    expect(REVIEW_WINDOWS_UNSIGNED).toBe(
      [
        CLINICAL_VALUES.triageReviewRiskSoon,
        CLINICAL_VALUES.triageReviewRiskMid,
        CLINICAL_VALUES.triageReviewRiskWeek,
      ].some((entry: { status: string }) => entry.status !== "signed"),
    );
    expect(FOLLOW_UP_WINDOWS_UNSIGNED).toBe(true);
    expect(REVIEW_WINDOWS_UNSIGNED).toBe(true);
  });
});
