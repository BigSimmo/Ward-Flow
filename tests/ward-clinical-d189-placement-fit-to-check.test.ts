import { describe, expect, it } from "vitest";

import { riskFlagLabel } from "@/components/ward-management/referrals/referral-risk-flags";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { NOT_RECORDED_OBSERVATION } from "@/components/ward-management/ward-observation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  FIT_TO_CHECK_HEADING,
  FIT_TO_CHECK_LINE,
  fitToCheck,
  patientFitLine,
  referralFit,
} from "@/components/ward-management/ward/ward-referral-fit";

/**
 * D-187 item 9 (Q30) and D-189 item 9(i), flag 9: recorded risk, escort need, observation level and
 * medical clearance show in the ward fit check as "To check", each with its recorded fact or "Not
 * recorded", and never as a fail. Authorisation is information only (D-189 item 8(a)), so the bed
 * check total drops by one.
 */

const NOW = NOW_ANCHOR;
const SEED = seedWardFlowState();
const BASE = SEED.movements.find((movement) => movement.closure === undefined)!;

function movement(overrides: Partial<Movement>): Movement {
  return { ...BASE, ...overrides };
}

function fittingUnit(subject: Movement): Unit {
  const unit = SEED.units.find((candidate) => {
    const fit = referralFit(eligibility(subject, candidate, NOW).gates, candidate, NOW);
    return fit.patientIssues.length === 0;
  });
  if (!unit) throw new Error("the seed has no ward this movement fits");
  return unit;
}

describe("the fit check's To check group", () => {
  it("with risk flags, an escort, no clearance and no observation level: no issue, four facts to check", () => {
    const subject = movement({
      legalStatus: "Involuntary inpatient",
      observation: NOT_RECORDED_OBSERVATION,
      medicalClearance: undefined,
      transport: { ...(BASE.transport ?? ({} as NonNullable<Movement["transport"]>)), escortRequired: true },
    });
    const unit = fittingUnit(subject);
    const fit = referralFit(eligibility(subject, unit, NOW).gates, unit, NOW);
    expect(fit.patientIssues).toEqual([]);

    // Risk flags from the referral letter only, and no intake, so clearance is not recorded anywhere.
    const rows = fitToCheck(subject, undefined, { riskFlags: ["aggression", "absconding"] }, NOW, riskFlagLabel);
    expect(rows.map((row) => `${row.label}: ${row.value}`)).toEqual([
      "Recorded risk: Aggression, Absent without leave",
      "Escort need: Yes",
      "Observation level: Not recorded",
      "Medical clearance: Not recorded",
    ]);
    expect(FIT_TO_CHECK_HEADING).toBe("To check");
    // None of the four is a bed check, so none can fail it or be counted.
    expect(fit.patientCheckNames.join(" ")).not.toMatch(/risk|escort|observation|clearance/iu);
  });

  it("reads each fact from the record: the movement first, then the intake, then the referral letter", () => {
    const cleared = movement({
      medicalClearance: { cleared: true, at: NOW - 30 },
      transport: { ...(BASE.transport ?? ({} as NonNullable<Movement["transport"]>)), escortRequired: false },
    });
    const intake = { riskFlags: [] as string[], medicalClearance: { cleared: false } };
    const rows = fitToCheck(cleared, intake, { riskFlags: ["suicide"] }, NOW, riskFlagLabel);
    expect(rows[0]).toEqual({ key: "risk", label: "Recorded risk", value: "None recorded" });
    expect(rows[1]).toEqual({ key: "escort", label: "Escort need", value: "No" });
    expect(rows[3]?.value).toMatch(/^Cleared at /u);

    const fromIntake = fitToCheck(
      movement({ medicalClearance: undefined, transport: undefined }),
      {
        riskFlags: ["suicide"],
        medicalClearance: { cleared: true },
      },
      undefined,
      NOW,
      riskFlagLabel,
    );
    expect(fromIntake.map((row) => row.value)).toEqual([
      "Suicide or self-harm",
      "Not recorded",
      fromIntake[2]!.value,
      "Cleared",
    ]);

    const notCleared = fitToCheck(
      movement({ medicalClearance: { cleared: false, at: NOW } }),
      undefined,
      undefined,
      NOW,
    );
    expect(notCleared[3]?.value).toBe("Not cleared");
    expect(notCleared[0]?.value).toBe("Not recorded");
  });

  it("the card line names the four to check and drops the authorisation check from the total", () => {
    const subject = movement({ legalStatus: "Involuntary inpatient" });
    const unit = fittingUnit(subject);
    const fit = referralFit(eligibility(subject, unit, NOW).gates, unit, NOW);
    expect(fit.patientCheckNames).not.toContain("MHA authorisation");
    // Go question 3 (Josh, 13 Nov 2026) adds the authorisation sentence for this status.
    expect(patientFitLine(fit)).toBe(
      `Passes the ${fit.patientTotal} bed checks. ${FIT_TO_CHECK_LINE} Involuntary admissions: authorised (Chief Psychiatrist register, 7 Sep 2026).`,
    );
    expect(FIT_TO_CHECK_LINE).toBe("To check: recorded risk, escort need, observation level and medical clearance.");
  });
});

describe("go question 3 (Josh, 13 Nov 2026): authorisation joins To check when the status needs it", () => {
  // D-209 item 9: the label now reads the Chief Psychiatrist's register (7 Sep 2026) for this ward.
  it("adds the ward's authorisation label for a status that needs an involuntary-capable bed", () => {
    const subject = movement({ legalStatus: "Involuntary inpatient" });
    const unit = fittingUnit(subject);
    const fit = referralFit(eligibility(subject, unit, NOW).gates, unit, NOW);
    expect(fit.patientIssues).toEqual([]);
    expect(fit.authorisationToCheck).toBe(
      "Involuntary admissions: authorised (Chief Psychiatrist register, 7 Sep 2026)",
    );
    expect(patientFitLine(fit)).toBe(
      `Passes the ${fit.patientTotal} bed checks. ${FIT_TO_CHECK_LINE} Involuntary admissions: authorised (Chief Psychiatrist register, 7 Sep 2026).`,
    );
    // Still information only: never counted and never a fail.
    expect(fit.patientCheckNames).not.toContain("MHA authorisation");
  });

  it("adds it when no legal status is recorded (the D-69 rule: needs an involuntary-capable bed until set)", () => {
    const subject = movement({ legalStatus: undefined });
    const unit = fittingUnit(subject);
    const fit = referralFit(eligibility(subject, unit, NOW).gates, unit, NOW);
    expect(fit.authorisationToCheck).toBe(
      "Involuntary admissions: authorised (Chief Psychiatrist register, 7 Sep 2026)",
    );
  });

  it("adds nothing for a voluntary status", () => {
    const subject = movement({ legalStatus: "Voluntary" });
    const unit = fittingUnit(subject);
    const fit = referralFit(eligibility(subject, unit, NOW).gates, unit, NOW);
    expect(fit.authorisationToCheck).toBeUndefined();
    expect(patientFitLine(fit)).toBe(`Passes the ${fit.patientTotal} bed checks. ${FIT_TO_CHECK_LINE}`);
  });
});
