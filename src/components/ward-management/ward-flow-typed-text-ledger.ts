import { isDischargeCriterion } from "@/components/ward-management/ward-discharge-criteria";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import {
  eventCarriesTypedTextPayload,
  WARD_FLOW_TEXT_SAFE_EVENT_TYPES,
} from "@/components/ward-management/ward-flow-persistence-classification";

export { TYPED_TEXT_NOT_KEPT } from "@/components/ward-management/ward-flow-demo-storage-constants";

/** Every typed value this session has dispatched, in memory only. Never saved, logged or sent. */
export type TypedTextLedger = readonly string[];

/** One comparison form for typed text, so case, spacing and Unicode width cannot hide a match. */
export function normaliseTypedText(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

type TypedTextEventType =
  | "ADD_PATIENT"
  | "RECEIVE_REFERRAL"
  | "RECORD_MOVEMENT_BLOCKER"
  | "REFER_TO_COMMUNITY_TEAM"
  | "RECORD_ESCALATION"
  | "ADD_REFERRAL_CORRECTION"
  | "BOOK_TRANSPORT"
  | "RECORD_REPATRIATION"
  | "RECORD_TRANSPORT_CAD"
  | "SET_ARRIVAL_DETAILS"
  | "UPLOAD_PATIENT_FORM"
  | "DISPATCH_BROADCAST_ALERT"
  | "BOOK_PLANNED_ADMISSION"
  | "RECORD_SUPPORT_NOTIFICATION";

/**
 * Default deny inside each typed-text event: EVERY string in its payload is treated as typed except
 * under the keys listed here, each of which is an id, the caller's role or a value chosen from a
 * fixed list. A field added later is typed until someone reviews it and lists it. Listing a key here
 * by mistake is the one way to leak, so each list is kept to keys read in `ward-flow-events.ts`.
 * `tests/ward-flow-typed-text-ledger.test.ts` keeps this table's keys equal to
 * `WARD_FLOW_TYPED_TEXT_EVENT_TYPES`.
 */
const NOT_TYPED_KEYS: { readonly [T in TypedTextEventType]: readonly string[] } = {
  ADD_PATIENT: ["registrationScope", "gender", "sex"],
  RECEIVE_REFERRAL: [
    "submissionId",
    "patientId",
    "ageBand",
    "homeRegion",
    "kind",
    "sex",
    "edId",
    "reason",
    "source",
    "originUnitId",
    "actingUnitId",
    "atsCategory",
    "originSiteCode",
    "tentativeDiagnosis",
    "service",
    "riskFlags",
    "mimeType",
    "clearanceChecklist",
    "firstContact",
  ],
  RECORD_MOVEMENT_BLOCKER: ["movementId"],
  REFER_TO_COMMUNITY_TEAM: ["movementId"],
  RECORD_ESCALATION: ["movementId", "triedUnitIds"],
  ADD_REFERRAL_CORRECTION: ["referralId", "actingPlaceId"],
  BOOK_TRANSPORT: ["movementId", "provider", "actingUnitId", "actingPlaceId", "transportLegalStatus", "gaps", "reason"],
  RECORD_REPATRIATION: ["admissionId", "mode", "provider", "transportLegalStatus"],
  RECORD_TRANSPORT_CAD: ["movementId", "actingUnitId"],
  SET_ARRIVAL_DETAILS: ["actingUnitId", "movementId", "arrivalMode"],
  UPLOAD_PATIENT_FORM: ["movementId", "fileType"],
  DISPATCH_BROADCAST_ALERT: ["severity", "category", "targetScope", "kind"],
  BOOK_PLANNED_ADMISSION: ["patientId", "sex", "gender", "reason", "unitId", "legalStatus", "ageBand"],
  RECORD_SUPPORT_NOTIFICATION: ["occasion", "movementId", "admissionId", "party", "outcome"],
};

/** Keys that are never typed in any event: the discriminant and the caller's role. */
const ALWAYS_NOT_TYPED: ReadonlySet<string> = new Set(["type", "role"]);
const EMPTY: ReadonlySet<string> = new Set();

/** `topSkip` applies to the payload's own keys only: a nested `role` (a referrer's) is typed. */
function stringsUnder(value: unknown, skip: ReadonlySet<string>, found: string[], topSkip = ALWAYS_NOT_TYPED): void {
  if (typeof value === "string") found.push(value);
  else if (Array.isArray(value)) for (const entry of value) stringsUnder(entry, skip, found, EMPTY);
  else if (value && typeof value === "object")
    for (const [key, entry] of Object.entries(value))
      if (!skip.has(key) && !topSkip.has(key)) stringsUnder(entry, skip, found, EMPTY);
}

function isTypedTextEventType(type: WardFlowEvent["type"]): type is TypedTextEventType {
  return Object.hasOwn(NOT_TYPED_KEYS, type);
}

/** The event types this file can read typed values from. For the coverage test only. */
export const TYPED_TEXT_LEDGER_EVENT_TYPES: readonly string[] = Object.keys(NOT_TYPED_KEYS);

/**
 * The typed values one dispatched event carries, or `null` when the event carries typed text this
 * file cannot read (a typed-text type with no entry above). `null` means the caller must stop saving
 * for the rest of the session, as every typed-text event did before 21 Oct 2026. A text-safe event
 * with no typed payload returns an empty list.
 */
export function typedTextOf(event: WardFlowEvent): readonly string[] | null {
  const found: string[] = [];
  if (isTypedTextEventType(event.type)) {
    stringsUnder(event, new Set(NOT_TYPED_KEYS[event.type]), found);
  } else if (!WARD_FLOW_TEXT_SAFE_EVENT_TYPES.has(event.type)) {
    return null;
  }
  if (!eventCarriesTypedTextPayload(event)) return found;
  // The payload-level exceptions to "the type decides" (`eventCarriesTypedTextPayload`). A typed
  // payload that is none of the three read here is one this file does not know, so saving stops.
  const extra: string[] = [];
  let known = false;
  if ("overrideSignOff" in event && event.overrideSignOff !== undefined) {
    known = true;
    stringsUnder(event.overrideSignOff, EMPTY, extra);
  }
  if ("reassessmentNote" in event && typeof event.reassessmentNote === "string") {
    known ||= event.reassessmentNote.trim() !== "";
    extra.push(event.reassessmentNote);
  }
  if (event.type === "SET_DISCHARGE_CRITERIA") {
    const named: unknown[] = [
      ...(event.criteria ?? []),
      ...event.met,
      ...(event.patientSpecific ?? []),
      ...(event.tick ? [event.tick.criterion] : []),
    ];
    for (const criterion of named) {
      if (isDischargeCriterion(criterion)) continue;
      // An off-list value that is not a string cannot be read here; only a string is typed text.
      if (typeof criterion !== "string") return null;
      known = true;
      extra.push(criterion);
    }
  }
  if (!known) return null;
  found.push(...extra);
  return found;
}
