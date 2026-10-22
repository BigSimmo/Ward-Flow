import { GENDER_NO_LONGER_SUITS_REFUSAL } from "@/components/ward-management/ward-change-reasons";
import {
  GENDER_DESIGNATION_PRIVACY_SENTENCE,
  type EligibilityGate,
} from "@/components/ward-management/ward-eligibility";

export const WARD_GATE_LABELS: Record<EligibilityGate, string> = {
  acuity: "Acuity",
  age: "Age band",
  allocatable_bed: "Allocatable bed",
  authorisation: "Authorisation",
  capacity_freshness: "Capacity freshness",
  cohort: "Cohort",
  forensic: "Forensic bed",
  legal_status: "Legal status",
  prior_decline: "Prior decline",
  security: "Security",
  gender_designation: "Bed designation",
  sex_mix: "Sex mix",
  specialling: "Observation staff",
};

// The reducer's front-door refusal: "<ward> is not eligible for movement <id> — failed gate <key>: <detail>".
const ENGINE_REFUSAL =
  /^(.+?) (?:is not eligible for movement|does not accept referral|cannot accept referral) \S+ — failed gate ([a-z_]+): (.+)$/su;

/**
 * A reducer refusal as a ward or ED screen shows it. Gender and sex wording collapses to the one
 * generic sentence, the gate key becomes its label, the record id drops out and dashes become commas.
 */
export function wardSafeRejectionReason(reason: string): string {
  const lower = reason.toLowerCase();
  if (lower.includes("non-binary")) return GENDER_DESIGNATION_PRIVACY_SENTENCE;
  if (lower.includes("no longer suits this patient")) return GENDER_NO_LONGER_SUITS_REFUSAL;
  const match = ENGINE_REFUSAL.exec(reason);
  const text = match
    ? `${match[1]} fails the ${(WARD_GATE_LABELS[match[2] as EligibilityGate] ?? match[2].replace(/_/g, " ")).toLowerCase()} check. ${match[3]}`
    : reason;
  return text.replace(/ — /g, ", ");
}
