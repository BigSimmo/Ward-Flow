import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";

import { FACTOR_NAME } from "./triage-risk-data";
import {
  TRIAGE_FLAG_KEY,
  TRIAGE_LEGAL_CODES,
  TRIAGE_MAX_FLAGS,
  TRIAGE_OUTCOMES,
  TRIAGE_REVIEW_CODES,
  TRIAGE_URGENCIES,
  type TriageSignedEvent,
  type TriageSignedRecord,
} from "./triage-record";

/*
 * The signed triage's reducer slice, loaded lazily with the other slices (`ward-flow-reducer-slices.ts`),
 * so the factor list it checks against stays out of a phone's first load.
 */

type Reject = (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;

const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (list as readonly string[]).includes(value);

/**
 * RECORD_TRIAGE_SIGNED. Who may send it is `EVENT_ROLE`; which person is the shared server's record
 * check. Every field is checked against its closed list and only those fields are kept, so nothing
 * else a caller sends is stored.
 */
export function reduceTriageSigned(state: WardFlowState, event: TriageSignedEvent, reject: Reject): WardFlowState {
  if (typeof event.patientId !== "string" || !state.patients.some((patient) => patient.id === event.patientId))
    return reject(state, event, "RECORD_TRIAGE_SIGNED names no person on this workspace");
  if (!isOneOf(TRIAGE_URGENCIES, event.urgency)) return reject(state, event, "Choose an urgency from A to G");
  if (!isOneOf(TRIAGE_OUTCOMES, event.outcome)) return reject(state, event, "Choose an outcome from the list");
  if (!isOneOf(TRIAGE_LEGAL_CODES, event.legal)) return reject(state, event, "Choose a legal status from the list");
  if (!isOneOf(TRIAGE_REVIEW_CODES, event.review)) return reject(state, event, "Choose when risk is reviewed");
  const flags = Array.isArray(event.riskFlags) ? event.riskFlags : null;
  if (
    !flags ||
    flags.length > TRIAGE_MAX_FLAGS ||
    flags.some((key) => typeof key !== "string" || !TRIAGE_FLAG_KEY.test(key) || FACTOR_NAME[key] === undefined)
  )
    return reject(state, event, "Risk flags must be factors from the RAMP list");
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
  };
  return { ...state, triages: [...existing, record] };
}
