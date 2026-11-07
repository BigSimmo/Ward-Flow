import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";

/**
 * TRIAGE SIGNED (Josh's approved triage and risk mock-up, built 7 Nov 2026).
 *
 * Signing a triage records one fact on the person: that a triage was signed, when, by which desk,
 * and the structured answers a later triage or the patient record reads (urgency, outcome, legal
 * status, review, and which RAMP factors were marked present). Every one of those is a code from a
 * closed list that the reducer slice checks (`triage-signed-reducer.ts`).
 *
 * Nothing typed is in it. The assessment, mental state, formulation and plan, the reviewed time,
 * the referrer and any legal form or date as typed stay in the form's own React state and are gone
 * when the page is left. This file imports no screen code, so the reducer, the stored-state check
 * and the shared scoping read it without the form.
 */

/** Urgency tiers A to G: code, short and long words. The clinician always chooses; the form only hints. */
export const TIERS = [
  ["A", "Now", "Immediate"],
  ["B", "2 h", "Within 2 hours"],
  ["C", "12 h", "Within 12 hours"],
  ["D", "48 h", "Within 48 hours"],
  ["E", "2 wk", "Within 2 weeks"],
  ["F", "Recontact", "Further triage contact"],
  ["G", "No action", "No further action"],
] as const;
export type Tier = (typeof TIERS)[number][0];
export type TriageUrgency = Tier;
export const TRIAGE_URGENCIES: readonly Tier[] = TIERS.map(([tier]) => tier);
export const TIER_LONG = Object.fromEntries(TIERS.map(([tier, , long]) => [tier, long])) as Record<Tier, string>;
export const TIER_SHORT = Object.fromEntries(TIERS.map(([tier, short]) => [tier, short])) as Record<Tier, string>;

export const OUTCOMES = ["Accepted", "Referred on", "Advice only", "No further action"] as const;
export type TriageOutcome = (typeof OUTCOMES)[number];
export const TRIAGE_OUTCOMES: readonly TriageOutcome[] = OUTCOMES;

/**
 * Legal status in full words, as chosen on the form; nothing is computed or checked. A form number
 * or date is typed, so it is never on the record.
 */
export const LEGAL = [
  ["vol", "Voluntary"],
  ["ref", "Referred (Form 1A)"],
  ["det", "Detained"],
  ["cto", "Community treatment order"],
  ["ito", "Inpatient treatment order"],
  ["nyr", "Not yet recorded"],
] as const;
export type TriageLegalCode = (typeof LEGAL)[number][0];
export const TRIAGE_LEGAL_CODES: readonly TriageLegalCode[] = LEGAL.map(([code]) => code);

/** When risk is to be reviewed, as chosen on the form. */
export const REVIEW = [
  ["24h", "24 hours"],
  ["72h", "72 hours"],
  ["7d", "7 days"],
  ["move", "At transfer"],
  ["dis", "At discharge"],
] as const;
export type TriageReviewCode = (typeof REVIEW)[number][0];
export const TRIAGE_REVIEW_CODES: readonly TriageReviewCode[] = REVIEW.map(([code]) => code);

/** The most RAMP factors one record may name (the form has fewer than sixty). */
export const TRIAGE_MAX_FLAGS = 80;

/** A RAMP factor key, `area.kind.factor`, as the form names it. The reducer checks it against the list. */
export const TRIAGE_FLAG_KEY = /^(general|suicide|violence|other)\.(bg|now)\.[a-z]{2,8}$/;

export type TriageSignedEvent = {
  /**
   * A signed triage and risk assessment (SMHMR900 and SMHMR905) on one synthetic person. Codes,
   * ids and the instant only: never typed text (see the file comment).
   */
  type: "RECORD_TRIAGE_SIGNED";
  role: WardFlowRole;
  now: Instant;
  patientId: string;
  urgency: TriageUrgency;
  outcome: TriageOutcome;
  legal: TriageLegalCode;
  review: TriageReviewCode;
  /** RAMP factors marked present, as keys. Factors marked not present or not known are not named. */
  riskFlags: string[];
};

/** One signed triage, as the workspace keeps it. */
export type TriageSignedRecord = {
  patientId: string;
  at: Instant;
  by: WardFlowRole;
  urgency: TriageUrgency;
  outcome: TriageOutcome;
  legal: TriageLegalCode;
  review: TriageReviewCode;
  riskFlags: string[];
};

/** A person's signed triages, newest first. */
export function triagesFor(
  records: readonly TriageSignedRecord[] | undefined,
  patientId: string | undefined,
): TriageSignedRecord[] {
  if (!patientId) return [];
  return (records ?? []).filter((record) => record.patientId === patientId).sort((a, b) => b.at - a.at);
}
