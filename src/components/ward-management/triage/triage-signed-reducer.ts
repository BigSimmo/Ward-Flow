import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";

import { FACTOR_NAME } from "./triage-risk-data";
import {
  OUTCOMES,
  TRIAGE_ACTION_CODES,
  TRIAGE_FLAG_KEY,
  TRIAGE_LEGAL_CODES,
  TRIAGE_MAX_FLAGS,
  TRIAGE_PROBLEM_CODES,
  TRIAGE_REFERRAL_TYPE_CODES,
  TRIAGE_REVIEW_CODES,
  TRIAGE_URGENCIES,
  TRIAGE_VENUE_CODES,
  type TriageSignedEvent,
  type TriageSignedRecord,
} from "./triage-record";
import { TRIAGE_MAX_PICKS } from "./triage-psolis-lists";

/*
 * The signed triage's reducer slice, loaded lazily with the other slices (`ward-flow-reducer-slices.ts`),
 * so the factor list it checks against stays out of a phone's first load.
 */

type Reject = (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;

const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (list as readonly string[]).includes(value);

/** Codes from one list, deduplicated in the order chosen; null when any item is off the list. */
function pickedCodes<T extends string>(list: readonly T[], value: unknown): T[] | null {
  if (!Array.isArray(value) || value.length > TRIAGE_MAX_PICKS) return null;
  if (value.some((code) => !isOneOf(list, code))) return null;
  return [...new Set(value as T[])];
}

const isCodeOrNull = <T extends string>(list: readonly T[], value: unknown): value is T | null =>
  value === null || isOneOf(list, value);

/**
 * RECORD_TRIAGE_SIGNED. Who may send it is `EVENT_ROLE`; which person is the shared server's record
 * check. Every field is checked against its closed list and only those fields are kept, so nothing
 * else a caller sends is stored.
 */
export function reduceTriageSigned(state: WardFlowState, event: TriageSignedEvent, reject: Reject): WardFlowState {
  if (typeof event.patientId !== "string" || !state.patients.some((patient) => patient.id === event.patientId))
    return reject(state, event, "RECORD_TRIAGE_SIGNED names no person on this workspace");
  if (!isOneOf(TRIAGE_URGENCIES, event.urgency)) return reject(state, event, "Choose an urgency from A to G");
  if (!isOneOf(OUTCOMES, event.outcome)) return reject(state, event, "Choose an outcome from the list");
  if (!isOneOf(TRIAGE_LEGAL_CODES, event.legal)) return reject(state, event, "Choose a legal status from the list");
  if (!isOneOf(TRIAGE_REVIEW_CODES, event.review)) return reject(state, event, "Choose when risk is reviewed");
  const flags = Array.isArray(event.riskFlags) ? event.riskFlags : null;
  if (
    !flags ||
    flags.length > TRIAGE_MAX_FLAGS ||
    flags.some((key) => typeof key !== "string" || !TRIAGE_FLAG_KEY.test(key) || FACTOR_NAME[key] === undefined)
  )
    return reject(state, event, "Risk flags must be factors from the RAMP list");
  const problems = pickedCodes(TRIAGE_PROBLEM_CODES, event.problems);
  if (!problems) return reject(state, event, "Problems must be chosen from the problems list");
  const actions = pickedCodes(TRIAGE_ACTION_CODES, event.actions);
  if (!actions) return reject(state, event, "Actions must be chosen from the action plan list");
  if (!isCodeOrNull(TRIAGE_VENUE_CODES, event.venue)) return reject(state, event, "Choose a venue from the list");
  if (!isCodeOrNull(TRIAGE_REFERRAL_TYPE_CODES, event.referralType))
    return reject(state, event, "Choose a referral type from the list");
  const existing = Array.isArray(state.triages) ? state.triages : [];
  const record: TriageSignedRecord = {
    patientId: event.patientId,
    at: event.now,
    by: event.role,
    urgency: event.urgency,
    outcome: event.outcome,
    legal: event.legal,
    review: event.review,
    riskFlags: [...new Set(flags)],
    problems,
    actions,
    venue: event.venue,
    referralType: event.referralType,
  };
  return { ...state, triages: [...existing, record] };
}
