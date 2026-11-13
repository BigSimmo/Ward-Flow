import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";

import {
  ACTION_CODES,
  PROBLEM_CODES,
  type PSOLIS_ACTIONS,
  type PSOLIS_PROBLEMS,
  REFERRAL_TYPE_CODES,
  type REFERRAL_TYPES,
  VENUE_CODES,
  type VENUES,
} from "./triage-psolis-lists";

/**
 * TRIAGE SIGNED (Josh's approved triage and risk mock-up, built 7 Nov 2026).
 *
 * Signing a triage records one fact on the person: that a triage was signed, when, by which desk,
 * and the structured answers a later triage or the patient record reads (urgency, outcome, legal
 * status, review, which RAMP factors were marked present, and, from 7 Nov 2026 (Josh), the problems,
 * actions, venue and referral type). Every one of those is a code from a closed list that the reducer
 * slice checks (`triage-signed-reducer.ts`); the webPSOLIS lists are in `triage-psolis-lists.ts`.
 *
 * Nothing typed is in it. The assessment, mental state, formulation and plan, the reviewed time,
 * the referrer and any legal form or date as typed stay in the form's own React state and are gone
 * when the page is left. This file imports no screen code, so the reducer, the stored-state check
 * and the shared scoping read it without the form.
 *
 * A row saved before 7 Nov 2026 has no problems, actions, venue or referral type, so those four
 * are optional on the stored record (`TriageSignedRecord`); a reader treats a missing one as none.
 */

// The windows for B to E come from the clinical values list (Josh, 7 Nov 2026), never typed here.
const DAYS_PER_WEEK = 7;
const URGENCY_B = CLINICAL_VALUES.triageUrgencyB.value;
const URGENCY_C = CLINICAL_VALUES.triageUrgencyC.value;
const URGENCY_D = CLINICAL_VALUES.triageUrgencyD.value;
const URGENCY_E_WEEKS = CLINICAL_VALUES.triageUrgencyE.value / DAYS_PER_WEEK;

/** Urgency tiers A to G: code, short and long words. The clinician always chooses; the form only hints. */
export const TIERS = [
  ["A", "Now", "Immediate"],
  ["B", `${URGENCY_B} h`, `Within ${URGENCY_B} hours`],
  ["C", `${URGENCY_C} h`, `Within ${URGENCY_C} hours`],
  ["D", `${URGENCY_D} h`, `Within ${URGENCY_D} hours`],
  ["E", `${URGENCY_E_WEEKS} wk`, `Within ${URGENCY_E_WEEKS} weeks`],
  ["F", "Recontact", "Further triage contact"],
  ["G", "No action", "No further action"],
] as const;
export type Tier = (typeof TIERS)[number][0];
export const TRIAGE_URGENCIES: readonly Tier[] = TIERS.map(([tier]) => tier);
export const TIER_LONG = Object.fromEntries(TIERS.map(([tier, , long]) => [tier, long])) as Record<Tier, string>;
export const TIER_SHORT = Object.fromEntries(TIERS.map(([tier, short]) => [tier, short])) as Record<Tier, string>;

export const OUTCOMES = ["Accepted", "Referred on", "Advice only", "No further action"] as const;
type TriageOutcome = (typeof OUTCOMES)[number];

/**
 * Legal status in full words, as chosen on the form; nothing is computed or checked. A form number
 * or date is typed, so it is never on the record.
 */
export const LEGAL = [
  ["vol", "Voluntary"],
  // D-187 item 18 (TW-107): the approved status words (D-170 item 4, D-187 item 2), not tied to a form number.
  ["ref", "Referred for psychiatric examination"],
  ["det", "Detained"],
  ["cto", "Community treatment order"],
  ["ito", "Inpatient treatment order"],
  ["nyr", "Not yet recorded"],
] as const;
export type TriageLegalCode = (typeof LEGAL)[number][0];
export const TRIAGE_LEGAL_CODES: readonly TriageLegalCode[] = LEGAL.map(([code]) => code);

/** When risk is to be reviewed, as chosen on the form. */
export const REVIEW = [
  ["24h", `${CLINICAL_VALUES.triageReviewRiskSoon.value} hours`],
  ["72h", `${CLINICAL_VALUES.triageReviewRiskMid.value} hours`],
  ["7d", `${CLINICAL_VALUES.triageReviewRiskWeek.value} days`],
  ["move", "At transfer"],
  ["dis", "At discharge"],
] as const;
export type TriageReviewCode = (typeof REVIEW)[number][0];
/**
 * Review question 6 (labelling only): true while any "Review risk by" window is unsigned in the values
 * register, so the form marks the choices "Window not signed." as the see-by window is marked.
 */
export const REVIEW_WINDOWS_UNSIGNED = (
  [
    CLINICAL_VALUES.triageReviewRiskSoon,
    CLINICAL_VALUES.triageReviewRiskMid,
    CLINICAL_VALUES.triageReviewRiskWeek,
  ] as readonly { status: string }[]
).some((entry) => entry.status !== "signed");
export const TRIAGE_REVIEW_CODES: readonly TriageReviewCode[] = REVIEW.map(([code]) => code);

/** The most RAMP factors one record may name (the form has fewer than sixty). */
export const TRIAGE_MAX_FLAGS = 80;

/** A RAMP factor key, `area.kind.factor`, as the form names it. The reducer checks it against the list. */
export const TRIAGE_FLAG_KEY = /^(general|suicide|violence|other)\.(bg|now)\.[a-z]{2,8}$/;

/** Problem, action, venue and referral type codes: closed unions from the webPSOLIS lists. */
export type TriageProblemCode = (typeof PSOLIS_PROBLEMS)[number][0];
export type TriageActionCode = (typeof PSOLIS_ACTIONS)[number][0];
export type TriageVenueCode = (typeof VENUES)[number][0];
export type TriageReferralTypeCode = (typeof REFERRAL_TYPES)[number][0];
export const TRIAGE_PROBLEM_CODES = PROBLEM_CODES as readonly TriageProblemCode[];
export const TRIAGE_ACTION_CODES = ACTION_CODES as readonly TriageActionCode[];
export const TRIAGE_VENUE_CODES = VENUE_CODES as readonly TriageVenueCode[];
export const TRIAGE_REFERRAL_TYPE_CODES = REFERRAL_TYPE_CODES as readonly TriageReferralTypeCode[];

export type TriageSignedEvent = {
  /**
   * A signed triage and risk assessment (SMHMR900 and SMHMR905) on one synthetic person. Codes,
   * ids and the instant only: never typed text (see the file comment).
   */
  type: "RECORD_TRIAGE_SIGNED";
  role: WardFlowRole;
  now: Instant;
  patientId: string;
  urgency: Tier;
  outcome: TriageOutcome;
  legal: TriageLegalCode;
  review: TriageReviewCode;
  /** RAMP factors marked present, as keys. Factors marked not present or not known are not named. */
  riskFlags: string[];
  /** Problem codes (`PROBLEM_CODES`), in the order chosen. Never typed text. */
  problems: TriageProblemCode[];
  /** Action plan codes (`ACTION_CODES`), in the order chosen. Never typed text. */
  actions: TriageActionCode[];
  /** Venue code (`VENUE_CODES`), or null when none is chosen. */
  venue: TriageVenueCode | null;
  /** Referral type code (`REFERRAL_TYPE_CODES`), or null when none is chosen. */
  referralType: TriageReferralTypeCode | null;
};

/** One signed triage, as the workspace keeps it. */
export type TriageSignedRecord = {
  patientId: string;
  at: Instant;
  by: WardFlowRole;
  urgency: Tier;
  outcome: TriageOutcome;
  legal: TriageLegalCode;
  review: TriageReviewCode;
  riskFlags: string[];
  /**
   * Problem and action codes in the order chosen, venue and referral type codes or null. Optional
   * only because a row saved before 7 Nov 2026 has none; the reducer always writes all four.
   */
  problems?: TriageProblemCode[];
  actions?: TriageActionCode[];
  venue?: TriageVenueCode | null;
  referralType?: TriageReferralTypeCode | null;
};

/** A person's signed triages, newest first. */
export function triagesFor(
  records: readonly TriageSignedRecord[] | undefined,
  patientId: string | undefined,
): TriageSignedRecord[] {
  if (!patientId) return [];
  return (records ?? []).filter((record) => record.patientId === patientId).sort((a, b) => b.at - a.at);
}
