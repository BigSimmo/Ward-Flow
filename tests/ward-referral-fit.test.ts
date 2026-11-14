// Josh's screenshot of 22 Oct 2026: two failed ward checks read as "Does not meet every placement
// requirement" although the patient passed every patient check. The fit is now split.
import { describe, expect, it } from "vitest";

import type { GateResult } from "@/components/ward-management/ward-eligibility";
import type { Unit } from "@/components/ward-management/ward-model";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { patientFitLine, referralFit, wardStateLine } from "@/components/ward-management/ward/ward-referral-fit";

const unit: Unit = seedWardFlowState().units[0];
const now = unit.allocatable.confirmedAt + 300;

const pass = (gate: GateResult["gate"], detail = "ok"): GateResult => ({ gate, pass: true, detail });
const fail = (gate: GateResult["gate"], detail: string): GateResult => ({ gate, pass: false, detail });

// D-189 item 8(a): authorisation is information only while every ward reads "not stated", so it is
// listed as the engine gives it and is not one of the six bed checks.
const PATIENT_PASSES: GateResult[] = [
  { gate: "authorisation", pass: true, info: true, need: true, detail: "Involuntary admissions: not stated" },
  pass("cohort"),
  pass("security"),
  pass("gender_designation"),
  pass("forensic"),
  pass("sex_mix"),
  pass("prior_decline"),
];

describe("referralFit", () => {
  it("keeps a stale bed count and no free bed out of the patient's fit", () => {
    const fit = referralFit(
      [...PATIENT_PASSES, fail("capacity_freshness", "stale"), fail("allocatable_bed", "0 allocatable")],
      unit,
      now,
    );
    expect(fit.patientPassed).toBe(6);
    expect(fit.patientTotal).toBe(6);
    // D-187 item 9: the four recorded facts are named as to check, never counted. The fixture's
    // authorisation gate marks a need, so go question 3 (Josh, 13 Nov 2026) adds its label.
    expect(patientFitLine(fit)).toBe(
      "Passes the 6 bed checks. To check: recorded risk, escort need, observation level and medical clearance. Involuntary admissions: not stated.",
    );
    // Root-cause 6.1 guard: never claim a full fit the check did not make.
    expect(patientFitLine(fit)).not.toMatch(/fits this ward/iu);
    expect(wardStateLine(fit, now, unit)).toBe("Your bed count is 5 h old and shows no free bed.");
    expect(fit.wardIssues.map((issue) => issue.gate)).toEqual(["capacity_freshness", "allocatable_bed"]);
  });

  it("names a failed patient check in the ward's own wording", () => {
    const fit = referralFit(
      [...PATIENT_PASSES.slice(0, 4), fail("forensic", "This is a forensic ward."), ...PATIENT_PASSES.slice(5)],
      unit,
      now,
    );
    expect(patientFitLine(fit)).toBe("Does not fit this ward. This is a forensic ward.");
    expect(wardStateLine(fit, now, unit)).toBeUndefined();
  });

  it("never repeats the gender designation detail, only the privacy sentence", () => {
    const fit = referralFit(
      [...PATIENT_PASSES.slice(0, 3), fail("gender_designation", "female only"), ...PATIENT_PASSES.slice(4)],
      unit,
      now,
    );
    expect(patientFitLine(fit)).not.toMatch(/female/iu);
  });

  it("leaves information-only gates out of the count", () => {
    const fit = referralFit([...PATIENT_PASSES, { gate: "acuity", pass: true, detail: "info", info: true }], unit, now);
    expect(fit.patientTotal).toBe(6);
  });
});
