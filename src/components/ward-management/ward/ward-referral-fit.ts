import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import {
  checkedGates,
  wardFacingGateDetail,
  type EligibilityGate,
  type GateResult,
} from "@/components/ward-management/ward-eligibility";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { observationSummary } from "@/components/ward-management/ward-observation";

/**
 * The two gates that test the ward rather than the patient: whether the ward's bed count is
 * recent enough to trust, and whether it has a bed marked free. Josh's screenshot of 22 Oct 2026
 * showed both failing under "Does not meet every placement requirement", which read as if the
 * patient did not fit when every patient check had passed.
 */
const WARD_GATES: ReadonlySet<EligibilityGate> = new Set(["capacity_freshness", "allocatable_bed", "locked_bed_free"]);

/**
 * Plain names for the patient checks, in the order a ward reads them. Authorisation is information
 * only while every ward reads "not stated" (D-189 item 8(a)), so `checkedGates` leaves it out of the
 * count; its name stays for when Q42 is signed.
 */
const PATIENT_CHECK_NAMES: Partial<Record<EligibilityGate, string>> = {
  authorisation: "MHA authorisation",
  cohort: "age group",
  security: "security",
  gender_designation: "bed designation",
  forensic: "forensic",
  sex_mix: "gender mix",
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
  /**
   * Josh, 13 Nov 2026 (go question 3): when the person's recorded status needs an
   * involuntary-capable bed, the "To check" group adds the ward's authorisation label,
   * "Involuntary admissions: not stated". Undefined when the status does not need it.
   */
  authorisationToCheck?: string;
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
  // The information-only authorisation gate, marked as a need when the status needs it (D-69).
  const authorisation = gates.find(
    (gate) => (gate.gate === "authorisation" || gate.gate === "legal_status") && gate.info && gate.need,
  );
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
          : unit.isClosed
            ? CLOSED_TO_ADMISSIONS_LINE
            : gate.gate === "locked_bed_free"
              ? "No locked bed free now."
              : "No free bed now. You can still accept in principle.",
    })),
    ...(authorisation ? { authorisationToCheck: authorisation.detail } : {}),
  };
}

/**
 * D-187 item 9 (Q30) with D-189 item 9(i): recorded risk, escort need, observation level and medical
 * clearance show in the fit check as a "To check" group, each with its recorded fact or "Not
 * recorded". They are never a fail: never counted in "Passes the N bed checks", never in
 * `patientIssues`, and nothing is scored (D-71). This replaces the root-cause review 6.1 line that
 * said they were not part of the checks.
 */
export const FIT_TO_CHECK_HEADING = "To check";

/** The card's one-line form of the group, naming the four facts the full referral shows. */
export const FIT_TO_CHECK_LINE = "To check: recorded risk, escort need, observation level and medical clearance.";

export type FitToCheckRow = {
  key: "risk" | "escort" | "observation" | "clearance";
  label: "Recorded risk" | "Escort need" | "Observation level" | "Medical clearance";
  value: string;
};

/**
 * The four "to check" rows, each from the record only. Risk flags come from the submitted intake,
 * else the referral letter; "None recorded" when either exists with no flag, "Not recorded" when
 * neither does. Escort need is the transport booking's own answer. Medical clearance is the
 * movement's recorded clearance, else the intake's. `riskLabel` turns a flag into words (the
 * referral screens' `riskFlagLabel`), passed in so this file adds no screen-to-screen import.
 */
export function fitToCheck(
  movement: Pick<Movement, "transport" | "observation" | "medicalClearance">,
  intake: { riskFlags: readonly string[]; medicalClearance: { cleared: boolean } } | undefined,
  dossier: { riskFlags: readonly string[] } | undefined,
  now: Instant,
  riskLabel: (flag: string) => string = (flag) => flag,
): FitToCheckRow[] {
  const flags = intake?.riskFlags ?? dossier?.riskFlags;
  const risk =
    flags === undefined ? "Not recorded" : flags.length === 0 ? "None recorded" : flags.map(riskLabel).join(", ");
  const escort = movement.transport === undefined ? "Not recorded" : movement.transport.escortRequired ? "Yes" : "No";
  const clearance = movement.medicalClearance
    ? movement.medicalClearance.cleared
      ? `Cleared at ${formatInstantWithDay(movement.medicalClearance.at, now)}`
      : "Not cleared"
    : intake
      ? intake.medicalClearance.cleared
        ? "Cleared"
        : "Not cleared"
      : "Not recorded";
  return [
    { key: "risk", label: "Recorded risk", value: risk },
    { key: "escort", label: "Escort need", value: escort },
    { key: "observation", label: "Observation level", value: observationSummary(movement.observation) },
    { key: "clearance", label: "Medical clearance", value: clearance },
  ];
}

/** The one-line patient sentence for a card: names what was checked, never claims a full fit. */
export function patientFitLine(fit: ReferralFit): string {
  if (fit.patientIssues.length === 0) {
    const authorisation = fit.authorisationToCheck ? ` ${fit.authorisationToCheck}.` : "";
    return `Passes the ${fit.patientTotal} bed checks. ${FIT_TO_CHECK_LINE}${authorisation}`;
  }
  return `Does not fit this ward. ${fit.patientIssues.join(" ")}`;
}

/**
 * M14(c) (D-MCA (Josh, 14 Nov 2026)): a ward closed to admissions cannot accept, even in principle
 * (`ACCEPT_IN_PRINCIPLE` refuses it), so its card says so rather than offering acceptance.
 */
export const CLOSED_TO_ADMISSIONS_LINE = "Your ward is closed to admissions, so it cannot accept now.";

/** The one-line ward sentence for a card, or `undefined` when the ward has nothing to fix. */
export function wardStateLine(fit: ReferralFit, now: Instant, unit: Unit): string | undefined {
  if (unit.isClosed) return CLOSED_TO_ADMISSIONS_LINE;
  const stale = fit.wardIssues.some((issue) => issue.gate === "capacity_freshness");
  const noBed = fit.wardIssues.some((issue) => issue.gate === "allocatable_bed");
  if (stale && noBed)
    return `Your bed count is ${ageWords(now - unit.allocatable.confirmedAt)} old and shows no free bed.`;
  if (stale) return `Your bed count is ${ageWords(now - unit.allocatable.confirmedAt)} old.`;
  if (noBed) return "No free bed now. You can still accept in principle.";
  return undefined;
}
