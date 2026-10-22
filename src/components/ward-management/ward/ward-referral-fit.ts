import type { Instant } from "@/components/ward-management/ward-clock";
import {
  checkedGates,
  wardFacingGateDetail,
  type EligibilityGate,
  type GateResult,
} from "@/components/ward-management/ward-eligibility";
import type { Unit } from "@/components/ward-management/ward-model";

/**
 * The two gates that test the ward rather than the patient: whether the ward's bed count is
 * recent enough to trust, and whether it has a bed marked free. Josh's screenshot of 22 Oct 2026
 * showed both failing under "Does not meet every placement requirement", which read as if the
 * patient did not fit when every patient check had passed.
 */
const WARD_GATES: ReadonlySet<EligibilityGate> = new Set(["capacity_freshness", "allocatable_bed"]);

/** Plain names for the patient checks, in the order a ward reads them. */
const PATIENT_CHECK_NAMES: Partial<Record<EligibilityGate, string>> = {
  authorisation: "MHA authorisation",
  cohort: "age group",
  security: "security",
  gender_designation: "bed designation",
  forensic: "forensic",
  sex_mix: "sex mix",
  prior_decline: "not declined here before",
};

export type ReferralFit = {
  /** Patient checks that pass, and how many there are. */
  patientPassed: number;
  patientTotal: number;
  /** Plain names of every patient check, for the "which checks" line. */
  patientCheckNames: string[];
  /** Ward-facing wording of each failed patient check. */
  patientIssues: string[];
  /** What the ward itself has to fix, one sentence each. */
  wardIssues: { gate: EligibilityGate; text: string }[];
};

function ageWords(minutes: number): string {
  if (minutes < 60) return `${Math.max(0, minutes)} min`;
  return `${Math.round(minutes / 60)} h`;
}

/** Splits a ward's eligibility verdict into the patient's fit and the ward's own state. */
export function referralFit(gates: readonly GateResult[], unit: Unit, now: Instant): ReferralFit {
  const checked = checkedGates(gates);
  const patient = checked.filter((gate) => !WARD_GATES.has(gate.gate));
  const ward = checked.filter((gate) => WARD_GATES.has(gate.gate) && !gate.pass);
  return {
    patientPassed: patient.filter((gate) => gate.pass).length,
    patientTotal: patient.length,
    patientCheckNames: patient.map((gate) => PATIENT_CHECK_NAMES[gate.gate] ?? gate.gate.replace(/_/gu, " ")),
    patientIssues: patient.filter((gate) => !gate.pass).map((gate) => wardFacingGateDetail(gate)),
    wardIssues: ward.map((gate) => ({
      gate: gate.gate,
      text:
        gate.gate === "capacity_freshness"
          ? `Bed count last confirmed ${ageWords(now - unit.allocatable.confirmedAt)} ago.`
          : "No free bed now. You can still accept in principle and take the patient when a bed frees.",
    })),
  };
}

/** The one-line patient sentence for a card. */
export function patientFitLine(fit: ReferralFit): string {
  if (fit.patientIssues.length === 0) return `Fits this ward. All ${fit.patientTotal} patient checks pass.`;
  return `Does not fit this ward. ${fit.patientIssues.join(" ")}`;
}

/** The one-line ward sentence for a card, or `undefined` when the ward has nothing to fix. */
export function wardStateLine(fit: ReferralFit, now: Instant, unit: Unit): string | undefined {
  const stale = fit.wardIssues.some((issue) => issue.gate === "capacity_freshness");
  const noBed = fit.wardIssues.some((issue) => issue.gate === "allocatable_bed");
  if (stale && noBed)
    return `Your bed count is ${ageWords(now - unit.allocatable.confirmedAt)} old and shows no free bed.`;
  if (stale) return `Your bed count is ${ageWords(now - unit.allocatable.confirmedAt)} old.`;
  if (noBed) return "No free bed now. You can still accept in principle.";
  return undefined;
}
