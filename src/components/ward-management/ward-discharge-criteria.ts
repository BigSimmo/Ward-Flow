/**
 * CRITERIA LED DISCHARGE (Top 25 item 9, D-60). The treating psychiatrist sets the criteria a
 * voluntary patient must meet to go home. Once every one is met, the ward can confirm the discharge
 * without waiting for the next psychiatrist review. Involuntary patients are excluded: only a
 * psychiatrist can revoke the order, so their discharge always waits for one.
 *
 * Criteria are chosen from a fixed list, never typed, so the event stays on the persistence safe
 * list. They lapse after `CLINICAL_VALUES.dischargeCriteriaValidity` and then need a fresh review.
 */
import type { Instant } from "@/components/ward-management/ward-clock";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";

export const DISCHARGE_CRITERIA = [
  "Mental state unchanged since the psychiatrist's last review",
  "No new risk concerns raised by the treating team",
  "Accommodation confirmed",
  "Community follow up booked within 7 days",
  "Discharge medicines supplied and explained",
  "Family, carer or support person told",
  "Transport home arranged",
] as const;

export type DischargeCriterion = (typeof DISCHARGE_CRITERIA)[number];

export type DischargeCriteriaRecord = {
  /** When the treating psychiatrist set or last changed the list. The validity runs from here. */
  setAt: Instant;
  items: { criterion: DischargeCriterion; metAt: Instant | null }[];
};

export type DischargeCriteriaStatus =
  | { kind: "none" }
  | { kind: "paused" }
  | { kind: "lapsed"; met: number; total: number }
  | { kind: "in_progress"; met: number; total: number; lapsesAt: Instant }
  | { kind: "all_met"; total: number; lapsesAt: Instant };

export type CriteriaEligibility = "voluntary" | "involuntary" | "not_recorded";

export const CRITERIA_VOLUNTARY_ONLY =
  "Criteria led discharge is for voluntary patients only. An involuntary patient's discharge waits for the psychiatrist to revoke the order.";

export const CRITERIA_STATUS_NOT_RECORDED =
  "Criteria led discharge needs the patient recorded as voluntary. Check and record the legal status first.";

/** Why criteria cannot be set or used for this patient, or null when they are voluntary. */
export function criteriaEligibilityRefusal(eligibility: CriteriaEligibility): string | null {
  if (eligibility === "involuntary") return CRITERIA_VOLUNTARY_ONLY;
  if (eligibility === "not_recorded") return CRITERIA_STATUS_NOT_RECORDED;
  return null;
}

export function isDischargeCriterion(value: unknown): value is DischargeCriterion {
  return typeof value === "string" && (DISCHARGE_CRITERIA as readonly string[]).includes(value);
}

/** Where the criteria stand now. A patient no longer recorded as voluntary pauses them. */
export function dischargeCriteriaStatus(
  record: DischargeCriteriaRecord | null | undefined,
  eligibility: CriteriaEligibility,
  now: Instant,
): DischargeCriteriaStatus {
  if (!record || record.items.length === 0) return { kind: "none" };
  if (eligibility !== "voluntary") return { kind: "paused" };
  const total = record.items.length;
  const met = record.items.filter((item) => item.metAt !== null).length;
  const lapsesAt = record.setAt + CLINICAL_VALUES.dischargeCriteriaValidity.value;
  if (now >= lapsesAt) return { kind: "lapsed", met, total };
  return met === total ? { kind: "all_met", total, lapsesAt } : { kind: "in_progress", met, total, lapsesAt };
}

export type DischargeCriteriaChange = {
  criteria: readonly unknown[] | null;
  met: readonly unknown[];
  setByTreatingPsychiatrist: boolean;
};

/**
 * Whether criteria led discharge may be used. Involuntary uses the same wide reading as the
 * reducer's discharge guard (`patientRecordIsInvoluntary`): a patient record starting
 * "Involuntary" or detained awaiting examination, or a stay whose movement is not Voluntary. A
 * patient counts as voluntary only when that is recorded. Anything else, including no recorded
 * status or a community treatment order, is not recorded, so excluding a patient is the failure.
 */
export function criteriaEligibility(
  patientLegalStatus: string | undefined,
  movementLegalStatus: string | undefined,
  ctoInForce = false,
): CriteriaEligibility {
  if (ctoInForce) return "not_recorded";
  const patientStatus = patientLegalStatus?.trim();
  const recordInvoluntary =
    patientStatus !== undefined &&
    (/^involuntary\b/i.test(patientStatus) || patientStatus === "Detained awaiting examination");
  if (recordInvoluntary || (movementLegalStatus !== undefined && movementLegalStatus !== "Voluntary")) {
    return "involuntary";
  }
  if (movementLegalStatus === "Voluntary" || (patientStatus !== undefined && /^voluntary\b/i.test(patientStatus))) {
    return "voluntary";
  }
  return "not_recorded";
}

/**
 * The new record for a `SET_DISCHARGE_CRITERIA` event, or the reason it is refused. Clearing is
 * always allowed. Setting, changing or reviewing the list needs the treating psychiatrist and a
 * voluntary patient, and restarts the validity. Ticking criteria met keeps the list and its
 * validity, and is refused once the criteria have lapsed.
 */
export function nextDischargeCriteria(
  current: DischargeCriteriaRecord | null | undefined,
  change: DischargeCriteriaChange,
  eligibility: CriteriaEligibility,
  now: Instant,
): { record: DischargeCriteriaRecord | null } | { refusal: string } {
  if (change.criteria === null) return { record: null };
  const ineligible = criteriaEligibilityRefusal(eligibility);
  if (ineligible) return { refusal: ineligible };

  const criteria = change.criteria;
  if (criteria.length === 0) return { refusal: "Choose at least one discharge criterion, or clear them." };
  if (!criteria.every(isDischargeCriterion) || !change.met.every(isDischargeCriterion)) {
    return { refusal: "Discharge criteria must be chosen from the list." };
  }
  if (new Set(criteria).size !== criteria.length) return { refusal: "Each discharge criterion can be chosen once." };
  if (!change.met.every((criterion) => criteria.includes(criterion))) {
    return { refusal: "Only a chosen discharge criterion can be marked met." };
  }

  const items = current?.items ?? [];
  const sameList = items.length === criteria.length && items.every((item, index) => item.criterion === criteria[index]);
  if (!change.setByTreatingPsychiatrist) {
    if (!current || !sameList) return { refusal: "Discharge criteria are set by the treating psychiatrist." };
    if (now >= current.setAt + CLINICAL_VALUES.dischargeCriteriaValidity.value) {
      return { refusal: "These criteria have lapsed. Ask the treating psychiatrist to review them." };
    }
  }

  const metBefore = new Map(items.map((item) => [item.criterion, item.metAt]));
  return {
    record: {
      setAt: change.setByTreatingPsychiatrist || !current ? now : current.setAt,
      items: criteria.map((criterion) => ({
        criterion,
        metAt: change.setByTreatingPsychiatrist
          ? null
          : change.met.includes(criterion)
            ? (metBefore.get(criterion) ?? now)
            : null,
      })),
    },
  };
}
