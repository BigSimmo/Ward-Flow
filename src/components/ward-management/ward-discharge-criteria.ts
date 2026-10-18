/**
 * CRITERIA LED DISCHARGE (Top 25 item 9, D-60). The treating psychiatrist sets the criteria a
 * voluntary patient must meet to go home. Once every one is met, the ward can confirm the discharge
 * without waiting for the next psychiatrist review. Involuntary patients are excluded: only a
 * psychiatrist can revoke the order, so their discharge always waits for one.
 *
 * Criteria are chosen from a fixed list. D-65: the treating psychiatrist can also add up to
 * `PATIENT_SPECIFIC_CRITERIA_MAX` patient specific criteria as typed text. A save or tick that carries
 * typed text stops browser saving like any typed-text event (`eventCarriesTypedTextPayload`). They
 * lapse after `CLINICAL_VALUES.dischargeCriteriaValidity` and then need a fresh review.
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
  // D-63: from MP 0181/24 Safety Planning, and the WACHS guideline's observations on the day of discharge.
  // A tick always falls inside the validity window (a review clears every tick), so "the last 24
  // hours" stays true while the criteria are live. Change the wording if the validity changes.
  "Safety plan reviewed with the patient",
  "Observations done and reviewed in the last 24 hours",
] as const;

export type DischargeCriterion = (typeof DISCHARGE_CRITERIA)[number];

/** D-65: input bounds for typed patient specific criteria (WACHS form MR28 Part B), not clinical values. */
export const PATIENT_SPECIFIC_CRITERIA_MAX = 3;
export const PATIENT_SPECIFIC_CRITERION_MAX_LENGTH = 120;

/** One criterion on the list. `patientSpecific` marks typed text the treating psychiatrist added. */
export type DischargeCriteriaItem =
  | { criterion: DischargeCriterion; metAt: Instant | null }
  | { criterion: string; metAt: Instant | null; patientSpecific: true };

export type DischargeCriteriaRecord = {
  /** When the treating psychiatrist set or last changed the list. The validity runs from here. */
  setAt: Instant;
  items: DischargeCriteriaItem[];
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

/** A typed patient specific criterion: trimmed, within the length bound and not a fixed criterion. */
function isPatientSpecificCriterionText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= PATIENT_SPECIFIC_CRITERION_MAX_LENGTH &&
    value.trim() === value &&
    !isDischargeCriterion(value)
  );
}

/**
 * A stored record holds fixed-list criteria, at most `PATIENT_SPECIFIC_CRITERIA_MAX` marked patient
 * specific criteria within the length bound (D-65), and finite times. Any other key is refused.
 */
export function isDischargeCriteriaRecord(value: unknown): value is DischargeCriteriaRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as { setAt?: unknown; items?: unknown };
  if (typeof record.setAt !== "number" || !Number.isFinite(record.setAt) || !Array.isArray(record.items)) return false;
  // Closed shape: an extra key could carry typed text.
  if (Object.keys(record).some((key) => key !== "setAt" && key !== "items")) return false;
  const seen = new Set<string>();
  let patientSpecific = 0;
  return record.items.every((item: unknown) => {
    if (typeof item !== "object" || item === null) return false;
    if (Object.keys(item).some((key) => key !== "criterion" && key !== "metAt" && key !== "patientSpecific")) {
      return false;
    }
    const {
      criterion,
      metAt,
      patientSpecific: marked,
    } = item as {
      criterion?: unknown;
      metAt?: unknown;
      patientSpecific?: unknown;
    };
    if ("patientSpecific" in item) {
      if (marked !== true || !isPatientSpecificCriterionText(criterion)) return false;
      patientSpecific += 1;
      if (patientSpecific > PATIENT_SPECIFIC_CRITERIA_MAX) return false;
    } else if (!isDischargeCriterion(criterion)) return false;
    if (seen.has(criterion)) return false;
    seen.add(criterion);
    return metAt === null || (typeof metAt === "number" && Number.isFinite(metAt));
  });
}

/**
 * A record browser storage may hold: fixed-list criteria only. Typed patient specific criteria are
 * typed text, so a saved state holding them is refused on restore (D-18, D-65).
 */
export function isFixedOnlyDischargeCriteriaRecord(value: unknown): value is DischargeCriteriaRecord {
  return isDischargeCriteriaRecord(value) && !value.items.some(isPatientSpecificItem);
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

/**
 * The short chip a bed tile shows for its criteria, or null when none are set. The WACHS Criteria
 * Led Discharge Guideline (16 Apr 2026, s 2.4 and 2.5) asks for a patient's criteria led discharge
 * status to be noted on journey boards, whiteboards and handover, not only in the record.
 */
export function criteriaLedTileChip(status: DischargeCriteriaStatus): CriteriaLedChip | null {
  switch (status.kind) {
    case "none":
      return null;
    case "all_met":
      return {
        label: "CLD ready",
        short: `CLD ${status.total}/${status.total}`,
        tone: "success",
        phrase: "Criteria led discharge, all criteria met",
      };
    case "in_progress":
      return {
        label: `CLD ${status.met}/${status.total}`,
        short: `CLD ${status.met}/${status.total}`,
        tone: "neutral",
        phrase: `Criteria led discharge, ${status.met} of ${status.total} criteria met`,
      };
    case "lapsed":
      return {
        label: "CLD review",
        short: "CLD",
        tone: "warning",
        phrase: "Criteria led discharge lapsed, review needed",
      };
    case "paused":
      return {
        label: "CLD paused",
        short: "CLD",
        tone: "warning",
        phrase: "Criteria led discharge paused, legal status no longer allows it",
      };
  }
}

/**
 * A tile's criteria led discharge chip. `short` fits a Bed board cell, where the glyph tells ready
 * (tick) from review or paused (warning); the cell's spoken name and tooltip carry `phrase`.
 */
export type CriteriaLedChip = {
  label: string;
  short: string;
  tone: "success" | "warning" | "neutral";
  phrase: string;
};

/**
 * What the bed panel says beside "Record that they have left", or null when no criteria are set.
 * It warns and never blocks. The WACHS guideline (s 3) asks the clinician facilitating the
 * discharge to instigate a medical review when any criterion is unmet or there is a concern.
 */
export function criteriaLedDepartureNote(status: DischargeCriteriaStatus): string | null {
  switch (status.kind) {
    case "none":
      return null;
    case "all_met":
      return "Criteria led discharge: all criteria met.";
    case "in_progress":
      return `Criteria led discharge: ${status.met} of ${status.total} met. Ask for a medical review before they leave.`;
    case "lapsed":
      return "Criteria led discharge has lapsed. Ask the treating psychiatrist for a review before they leave.";
    case "paused":
      return "Criteria led discharge is paused because the patient's legal status no longer allows it.";
  }
}

export type DischargeCriteriaChange = {
  criteria: readonly unknown[] | null;
  met: readonly unknown[];
  setByTreatingPsychiatrist: boolean;
  /**
   * D-65: typed patient specific criteria the treating psychiatrist set, added after the fixed ones.
   * Read only when the treating psychiatrist sets the list. A tick or change by the ward keeps the
   * stored ones.
   */
  patientSpecific?: readonly unknown[];
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

/** Whether a stored item is a typed patient specific criterion (D-65). */
export function isPatientSpecificItem(
  item: DischargeCriteriaItem,
): item is Extract<DischargeCriteriaItem, { patientSpecific: true }> {
  return "patientSpecific" in item && item.patientSpecific === true;
}

/**
 * The new record for a `SET_DISCHARGE_CRITERIA` event, or the reason it is refused. Clearing is
 * always allowed. Setting, changing or reviewing the list needs the treating psychiatrist and a
 * voluntary patient, and restarts the validity. Ticking criteria met keeps the list and its
 * validity, and is refused once the criteria have lapsed. Typed patient specific criteria (D-65)
 * follow the fixed ones and are ticked the same way.
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

  // Typed criteria come from the treating psychiatrist's save, otherwise from the stored list.
  let typed: readonly string[];
  if (change.setByTreatingPsychiatrist) {
    const entered = change.patientSpecific ?? [];
    if (entered.length > PATIENT_SPECIFIC_CRITERIA_MAX) {
      return { refusal: `Add at most ${PATIENT_SPECIFIC_CRITERIA_MAX} patient specific criteria.` };
    }
    if (!entered.every(isPatientSpecificCriterionText)) {
      return {
        refusal: `Each patient specific criterion needs text of up to ${PATIENT_SPECIFIC_CRITERION_MAX_LENGTH} characters that is not already on the list.`,
      };
    }
    typed = entered;
  } else {
    typed = (current?.items ?? []).filter(isPatientSpecificItem).map((item) => item.criterion);
  }
  const allowed = (value: unknown): value is string =>
    isDischargeCriterion(value) || (typeof value === "string" && typed.includes(value));

  let criteria: readonly unknown[] = change.criteria;
  let met: readonly unknown[] = change.met;
  const tick = change.setByTreatingPsychiatrist ? undefined : change.tick;
  if (tick) {
    if (!current) return { refusal: "Discharge criteria are set by the treating psychiatrist." };
    if (typeof tick.met !== "boolean") return { refusal: "A tick must say met or not met." };
    if (!allowed(tick.criterion) || !current.items.some((item) => item.criterion === tick.criterion)) {
      return { refusal: "Only a chosen discharge criterion can be marked met." };
    }
    const metNow = current.items.filter((item) => item.metAt !== null).map((item) => item.criterion);
    criteria = current.items.map((item) => item.criterion);
    met = tick.met ? [...metNow, tick.criterion] : metNow.filter((entry) => entry !== tick.criterion);
  } else if (change.setByTreatingPsychiatrist) {
    if (!criteria.every(isDischargeCriterion)) return { refusal: "Discharge criteria must be chosen from the list." };
    criteria = [...criteria, ...typed];
  }

  if (criteria.length === 0) return { refusal: "Choose at least one discharge criterion, or clear them." };
  if (!criteria.every(allowed) || !met.every(allowed)) {
    return { refusal: "Discharge criteria must be chosen from the list." };
  }
  const chosen = criteria as readonly string[];
  if (new Set(chosen).size !== chosen.length) return { refusal: "Each discharge criterion can be chosen once." };
  if (!met.every((criterion) => chosen.includes(criterion as string))) {
    return { refusal: "Only a chosen discharge criterion can be marked met." };
  }

  const items = current?.items ?? [];
  const sameList = items.length === chosen.length && items.every((item, index) => item.criterion === chosen[index]);
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
      items: chosen.map((criterion): DischargeCriteriaItem => {
        const metAt = change.setByTreatingPsychiatrist
          ? null
          : met.includes(criterion)
            ? (metBefore.get(criterion) ?? now)
            : null;
        return isDischargeCriterion(criterion) ? { criterion, metAt } : { criterion, metAt, patientSpecific: true };
      }),
    },
  };
}

/** Numbered typed-criterion placeholders for community and count-only executive snapshots. */
export function communityDischargeCriteria(
  record: DischargeCriteriaRecord | null | undefined,
): DischargeCriteriaRecord | null {
  if (!record) return null;
  let typed = 0;
  return {
    ...record,
    items: record.items.map((item) =>
      isPatientSpecificItem(item) ? { ...item, criterion: `Patient specific criterion ${++typed}` } : item,
    ),
  };
}
