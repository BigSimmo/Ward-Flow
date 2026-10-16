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

export type CriteriaEligibility = "voluntary" | "involuntary" | "cto" | "not_recorded";

export const CRITERIA_VOLUNTARY_ONLY =
  "Criteria led discharge is for voluntary patients only. An involuntary patient's discharge waits for the psychiatrist to revoke the order.";

export const CRITERIA_CTO_EXCLUDED =
  "Criteria led discharge is not used for a patient on a community treatment order. Their discharge waits for the treating psychiatrist.";

export const CRITERIA_STATUS_NOT_RECORDED =
  "Criteria led discharge needs the patient recorded as voluntary. Check and record the legal status first.";

/** Why criteria cannot be set or used for this patient, or null when they are voluntary. */
export function criteriaEligibilityRefusal(eligibility: CriteriaEligibility): string | null {
  if (eligibility === "involuntary") return CRITERIA_VOLUNTARY_ONLY;
  if (eligibility === "cto") return CRITERIA_CTO_EXCLUDED;
  if (eligibility === "not_recorded") return CRITERIA_STATUS_NOT_RECORDED;
  return null;
}

export function isDischargeCriterion(value: unknown): value is DischargeCriterion {
  return typeof value === "string" && (DISCHARGE_CRITERIA as readonly string[]).includes(value);
}

/** A stored record holds only fixed-list criteria and finite times, so a restored state cannot carry typed text. */
export function isDischargeCriteriaRecord(value: unknown): value is DischargeCriteriaRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as { setAt?: unknown; items?: unknown };
  if (typeof record.setAt !== "number" || !Number.isFinite(record.setAt) || !Array.isArray(record.items)) return false;
  const seen = new Set<string>();
  return record.items.every((item: unknown) => {
    if (typeof item !== "object" || item === null) return false;
    const { criterion, metAt } = item as { criterion?: unknown; metAt?: unknown };
    if (!isDischargeCriterion(criterion) || seen.has(criterion)) return false;
    seen.add(criterion);
    return metAt === null || (typeof metAt === "number" && Number.isFinite(metAt));
  });
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
  /**
   * One criterion ticked or unticked. When present it is applied to the stored list, so two quick
   * ticks queued from the same screen cannot undo each other.
   */
  tick?: { criterion: unknown; met: boolean };
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
  const patientStatus = patientLegalStatus?.trim();
  if (ctoInForce || (patientStatus !== undefined && /community treatment order/i.test(patientStatus))) return "cto";
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

  let criteria: readonly unknown[] = change.criteria;
  let met: readonly unknown[] = change.met;
  const tick = change.setByTreatingPsychiatrist ? undefined : change.tick;
  if (tick) {
    if (!current) return { refusal: "Discharge criteria are set by the treating psychiatrist." };
    if (!isDischargeCriterion(tick.criterion) || !current.items.some((item) => item.criterion === tick.criterion)) {
      return { refusal: "Only a chosen discharge criterion can be marked met." };
    }
    const metNow = current.items.filter((item) => item.metAt !== null).map((item) => item.criterion);
    criteria = current.items.map((item) => item.criterion);
    met = tick.met ? [...metNow, tick.criterion] : metNow.filter((entry) => entry !== tick.criterion);
  }

  if (criteria.length === 0) return { refusal: "Choose at least one discharge criterion, or clear them." };
  if (!criteria.every(isDischargeCriterion) || !met.every(isDischargeCriterion)) {
    return { refusal: "Discharge criteria must be chosen from the list." };
  }
  if (new Set(criteria).size !== criteria.length) return { refusal: "Each discharge criterion can be chosen once." };
  if (!met.every((criterion) => criteria.includes(criterion))) {
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
          : met.includes(criterion)
            ? (metBefore.get(criterion) ?? now)
            : null,
      })),
    },
  };
}
