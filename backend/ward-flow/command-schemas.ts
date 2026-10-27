import { z } from "zod";
import { EVENT_ROLE, type WardFlowEvent } from "../../src/components/ward-management/ward-flow-events";
import { CHART_MAX_BYTES } from "../../src/components/ward-management/referrals/referral-submission";
import {
  PATIENT_SPECIFIC_CRITERIA_MAX,
  PATIENT_SPECIFIC_CRITERION_MAX_LENGTH,
} from "../../src/components/ward-management/ward-discharge-criteria";
import { PARALLEL_REFERRAL_CAP } from "../../src/components/ward-management/ward-model";
import { REFERRAL_INFORMATION_NEED_IDS } from "../../src/components/ward-management/referrals/referral-information-needs";
import { PATIENT_ARCHIVE_REASONS } from "../../src/components/ward-management/ward-patient-archive";

/**
 * Shape checks for commands sent to the shared workspace, before the reducer sees them.
 *
 * Every command passes a general bound: a known type, an explicit role allowed for that type, and
 * plain JSON within size limits (depth, keys, list length and text length). The core bed-flow
 * commands then have a schema naming each field's type. Fields a schema does not name pass through
 * unchanged (the general bound still applies), so a field added to an event later is never
 * silently dropped; the reducer still owns every workflow rule.
 */
const MAX_DEPTH = 8;
const MAX_KEYS = 100;
const MAX_ITEMS = 500;
const MAX_TEXT = 4_000;
/**
 * A referral chart's file content, which the reducer checks against the chart's byte size. This
 * bound only stops this check refusing a chart; the server's 1 MiB request limit (server.mjs) is
 * the tighter cap on the shared board, because the whole saved workspace is capped at 8 MiB.
 */
const MAX_BASE64 = 4 * Math.ceil(CHART_MAX_BYTES / 3);
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
/**
 * Text PostgreSQL cannot store in `jsonb` (audit E-17): a NUL character, or half of a surrogate
 * pair. The engine would accept it and the save would then fail on every retry.
 */
const UNSTORABLE_TEXT = /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const storableText = (value: string, maxText: number) => value.length <= maxText && !UNSTORABLE_TEXT.test(value);

function boundedJson(value: unknown, depth: number, maxText = MAX_TEXT): boolean {
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return storableText(value, maxText);
  if (depth >= MAX_DEPTH || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.length <= MAX_ITEMS && value.every((item) => boundedJson(item, depth + 1));
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const entries = Object.entries(value);
  return (
    entries.length <= MAX_KEYS &&
    entries.every(
      ([key, item]) =>
        !FORBIDDEN_KEYS.has(key) &&
        storableText(key, 100) &&
        boundedJson(item, depth + 1, key === "base64" ? MAX_BASE64 : MAX_TEXT),
    )
  );
}

const id = z.string().min(1).max(200);
const label = z.string().min(1).max(200);
const text = z.string().max(MAX_TEXT);
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const instant = z.number().finite();
const ids = z.array(id).max(MAX_ITEMS);
/** A structured value the reducer checks itself, such as an override reason or exception. */
const record = z.record(z.string(), z.unknown());

const SCHEMAS: Partial<Record<WardFlowEvent["type"], z.ZodType>> = {
  MARK_REFERRAL_INFORMATION_MET: z
    .looseObject({
      referralId: id,
      need: z.enum(REFERRAL_INFORMATION_NEED_IDS),
      wardUnitId: id.optional(),
      allRequestingWards: z.literal(true).optional(),
    })
    .refine((value) => (value.wardUnitId !== undefined) !== (value.allRequestingWards === true)),
  OPEN_DISCHARGE_RECORD: z.looseObject({
    requestId: count,
    requestNamespace: z
      .string()
      .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      .optional(),
  }),
  RECEIVE_REFERRAL: z.looseObject({
    submissionId: z
      .string()
      .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      .optional(),
  }),
  ADD_PATIENT: z.looseObject({
    registrationScope: z
      .strictObject({ kind: z.enum(["ed", "ward", "team", "site", "service"]), placeId: id })
      .optional(),
  }),
  // #816: a patient id and a reason from the closed list, nothing typed.
  ARCHIVE_PATIENT: z.looseObject({ patientId: id, now: instant, reason: z.enum(PATIENT_ARCHIVE_REASONS) }),
  SET_CONFIGURATION: z.looseObject({ payload: record, baseConfiguration: record.optional() }),
  FLAG_MOVEMENT_TURNAROUND_PRIORITY: z.looseObject({
    movementId: id,
    unitId: id,
    now: instant,
    source: z.optional(z.enum(["cld", "departure"])),
  }),
  FLAG_REFERRAL_TURNAROUND_PRIORITY: z.looseObject({
    referralId: id,
    unitId: id,
    now: instant,
    source: z.optional(z.enum(["cld", "departure"])),
  }),
  // Fix plan item 16 (D-76): ward ids only, never more than the cap at once.
  ASK_MORE_WARDS: z.looseObject({
    referralId: id,
    now: instant,
    unitIds: z.array(id).min(1).max(PARALLEL_REFERRAL_CAP),
  }),
  RECORD_ARRIVED_IN_DEPARTMENT: z.looseObject({ referralId: id }),
  RECORD_MEDICAL_CLEARANCE: z.looseObject({ referralId: id, cleared: z.boolean() }),
  REQUEST_CAPACITY_REFRESH: z.looseObject({ unitId: id }),
  // H-0978: one exact bed closed or reopened. The reducer checks the bed and the reason list.
  SET_BED_CLOSED: z.looseObject({ unitId: id, actingUnitId: id, bedNumber: count, closed: z.boolean() }),
  CONFIRM_CAPACITY: z.looseObject({
    unitId: id,
    actingUnitId: id,
    value: count.max(10_000),
    expectedRevision: count.optional(),
  }),
  PULL_PATIENT: z.looseObject({
    movementId: id,
    unitId: id,
    overrideReason: z.union([label, record]).optional(),
    overrideSignOff: z.union([label, record]).optional(),
    numConsulted: z.literal(true).optional(),
    patientId: id.optional(),
    actingUnitId: id.optional(),
  }),
  RELEASE_PULL: z.looseObject({ movementId: id, reason: z.union([label, record]), actingUnitId: id.optional() }),
  TRANSPORT_EN_ROUTE: z.looseObject({ movementId: id }),
  PATIENT_COLLECTED: z.looseObject({ movementId: id, exception: record.optional() }),
  PATIENT_ARRIVED: z.looseObject({ movementId: id, actingUnitId: id.optional(), exception: record.optional() }),
  RECORD_ESCALATION: z.looseObject({ movementId: id, triedUnitIds: ids, contact: text }),
  CHANGE_URGENCY: z.looseObject({
    movementId: id,
    urgency: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    // Finding 15 (Josh, 27 Oct 2026): an urgency change may be saved without a reason.
    reason: z.union([label, record]).optional(),
  }),
  ACCEPT_REFERRAL: z.looseObject({
    referralId: id,
    destinationKind: label,
    unitId: id.optional(),
    overrideReason: z.union([label, record]).optional(),
    genderPlacementReason: z.union([label, record]).optional(),
    genderPlacementChecked: z.literal(true).optional(),
    bedNumber: count.optional(),
    actingUnitId: id.optional(),
    clinicalUpdate: z.boolean().optional(),
    reassessment: z.boolean().optional(),
    clearanceUpdated: z.boolean().optional(),
  }),
  DECLINE_REFERRAL: z.looseObject({
    referralId: id,
    destinationKind: label,
    reason: z.union([label, record]),
    waitlist: z.boolean().optional(),
    unitId: id.optional(),
    actingUnitId: id.optional(),
  }),
  UPDATE_EXPECTED_DISCHARGE: z.looseObject({
    admissionId: id,
    expectedDischargeAt: instant,
    actingUnitId: id.optional(),
  }),
  SET_DISCHARGE_CRITERIA: z.looseObject({
    admissionId: id,
    now: instant,
    criteria: z.array(z.unknown()).nullable(),
    met: z.array(z.unknown()),
    setByTreatingPsychiatrist: z.boolean(),
    // D-65: typed patient specific criteria. The reducer checks each one; this bounds the payload.
    patientSpecific: z
      .array(z.string().max(PATIENT_SPECIFIC_CRITERION_MAX_LENGTH))
      .max(PATIENT_SPECIFIC_CRITERIA_MAX)
      .optional(),
    tick: z.looseObject({ criterion: z.unknown(), met: z.boolean() }).optional(),
    actingUnitId: id.optional(),
  }),
  REVIEW_AUDIT_EVENT: z.looseObject({
    eventId: id,
    expectedGeneration: count,
    expectedReviewCount: count,
    decision: z.enum(["reviewed", "follow-up-required"]),
  }),
  ADVANCE_CLOCK: z.looseObject({ minutes: z.number().int().min(-100_000).max(100_000) }),
  RESET_SCENARIO: z.looseObject({}),
  SET_SCENARIO: z.looseObject({ scenario: label }),
};

/** The event types that have a field-level schema (the rest pass the general bound only). */
export const SCHEMA_TYPES = Object.freeze(Object.keys(SCHEMAS) as WardFlowEvent["type"][]);

/**
 * True when `value` is a command the shared workspace may hand to the reducer: a known type, an
 * explicit role allowed for it (never a default), bounded plain JSON, and, for the core commands,
 * fields of the right type.
 */
export function validSharedCommand(value: unknown): value is Record<string, unknown> & { type: WardFlowEvent["type"] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const fields = value as Record<string, unknown>;
  if (typeof fields.type !== "string" || !Object.hasOwn(EVENT_ROLE, fields.type)) return false;
  const type = fields.type as WardFlowEvent["type"];
  const roles: readonly string[] = EVENT_ROLE[type];
  if (typeof fields.role !== "string" || !roles.includes(fields.role)) return false;
  if (!boundedJson(value, 0)) return false;
  const schema = SCHEMAS[type];
  return !schema || schema.safeParse(value).success;
}
