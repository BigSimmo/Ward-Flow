import { validDischargeRequestNamespace } from "./ward-discharge-records";
import {
  RESTRICTIVE_PRACTICE_IDS,
  SECLUSION_ROOM_STATUS_IDS,
  WARD_INCIDENT_CATEGORY_IDS,
} from "@/components/ward-management/restrictive-practice/ward-restrictive-practice";
import { isPatientRegistrationScope } from "./ward-patient-registration";
import * as z from "zod/mini";
import { validCareJourney, validCareChange } from "./ward-care-journey";
import type { WardFlowState } from "./ward-flow-reducer";
import {
  isDischargeBarrier,
  isLeavingDestination,
  isPlannedAdmissionCancelReason,
  isPlannedAdmissionLegalStatus,
  isPlannedAdmissionReason,
  isPlannedAdmissionStayDays,
  PLANNED_ADMISSION_INITIALS_PATTERN,
  PLANNED_ADMISSION_STATES,
} from "./ward-admissions";
import { referralIntakeError, type ReferralIntakeDetails } from "./referrals/referral-submission";
import { REFERRAL_INFORMATION_NEED_IDS } from "./referrals/referral-information-needs";
import { REFERRAL_CONTACT_OUTCOME_IDS, REFERRAL_OWNER_DESKS } from "./referrals/referral-owner-and-calls";
import {
  MOVEMENT_STAGES,
  COHORTS,
  RECORDED_SEXES,
  REFERRAL_GENDERS,
  BED_RELEASE_STATES,
  REFERRAL_ADDRESSING_STATES,
  ABSENCE_STEPS,
  REFERRAL_DECLINE_REASONS,
  SUPPORT_SERVICE_TYPES,
  TRANSPORT_LEGAL_STATUSES,
  TRANSPORT_PROVIDERS,
} from "./ward-model";
import { BROADCAST_ANSWER_LABELS } from "./alerts/ward-broadcast-model";
import { validateConfiguration } from "./ward-configuration";
import { WARD_CLOSURE_REASONS, type WardClosureReason } from "./capacity/ward-closure";
import {
  BED_MEETING_ACTION_KINDS,
  BED_MEETING_ACTION_OWNERS,
  type BedMeetingActionKind,
} from "./bed-meeting/bed-meeting-actions";
import {
  isDischargeCriteriaRecord,
  isPatientSpecificItem,
  PATIENT_SPECIFIC_CRITERIA_MAX,
  type DischargeCriteriaRecord,
} from "./ward-discharge-criteria";
import { TYPED_TEXT_NOT_KEPT } from "./ward-flow-demo-storage-constants";
import { REPATRIATION_MODES } from "./ward-flow-events";
import { WARD_FLOW_ROLE_LABELS } from "./ward-flow-roles";
import { PAPER_EXPIRY_CORRECTION_REASONS } from "./ward-model-vocabulary";
import {
  SUPPORT_NOTIFICATION_OCCASIONS,
  SUPPORT_NOTIFICATION_OUTCOMES,
  SUPPORT_NOTIFICATION_PARTIES,
} from "./ward-support-notifications";
import { isSnoozeReason } from "./ward-inbox-snooze";
import { scenarioWardNetwork, WARD_SCENARIOS } from "./ward-scenarios";
import { communityTeamById } from "./community/community-derivations";
import { syntheticGovernanceAuditEvents } from "./ward-governance-seed";
import { UNDO_STEP_ACTIONS } from "./ward-undo";
import { BED_RELEASE_BLOCKERS } from "./ward-change-reasons";
import { numberedBedKind } from "./ward-bed-designation";
import { isObservation, type Observation } from "./ward-observation";
import { upgradeLegacyDeclineReasons } from "./ward-decline-legacy";
import { upgradeLegacyObservationRows } from "./ward-observation-legacy";
import { isTentativeDiagnosisBlock } from "./ward-diagnosis";
import { isCommunityReferralPurpose } from "./ward-model-referral-parts";

/**
 * The device copy's stand-in for the `n`th typed patient specific criterion (1 based). Numbered from
 * the second, because each criterion on a list must be distinct to be ticked (21 Oct 2026, the
 * typed-text device copy, D-72).
 */
export function typedCriterionNotKept(n: number): string {
  return n === 1 ? TYPED_TEXT_NOT_KEPT : `${TYPED_TEXT_NOT_KEPT} (${n})`;
}

const CRITERION_STAND_INS: ReadonlySet<string> = new Set(
  Array.from({ length: PATIENT_SPECIFIC_CRITERIA_MAX }, (_, index) => typedCriterionNotKept(index + 1)),
);

/**
 * A record browser storage may hold since 21 Oct 2026 (D-72): fixed-list criteria, and patient
 * specific criteria only as the device copy's stand-ins. The typed words themselves are still
 * refused on restore (D-18, D-65).
 */
function isDeviceCopyDischargeCriteriaRecord(value: unknown): value is DischargeCriteriaRecord {
  return (
    isDischargeCriteriaRecord(value) &&
    value.items.every((item) => !isPatientSpecificItem(item) || CRITERION_STAND_INS.has(item.criterion))
  );
}

// The stored-state fence runs in three passes, each only on what the previous one accepted:
//  1. `nested` walks every value: finite numbers only, no prototype keys, and the fixed shape of
//     each known history or record key wherever it appears.
//  2. `storedState` (zod) checks each collection's row shape, its fixed lists, and the facts one
//     row holds about itself.
//  3. `consistent` checks the links between rows and the counts they must agree with.
// `nested` refuses an `undefined` value under any key, so `.optional()` below means "absent".
// Objects are loose (unknown keys pass) except where a refusal of extra keys is noted: a CTO, an
// absence and a patient's identity fields, which must never carry restored free text.

type RecordValue = Record<string, unknown>;
const object = (v: unknown): v is RecordValue => typeof v === "object" && v !== null && !Array.isArray(v);
const fits = (schema: z.ZodMiniType, value: unknown) => schema.safeParse(value).success;

// zod 4 numbers refuse NaN and both infinities, and `z.int()` is a safe integer.
const finite = z.number();
const counter = z.int().check(z.nonnegative());
const text = z.string();
const bool = z.boolean();
const record = z.looseObject({});
const records = z.array(record);
const strings = z.array(text);
const nullableFinite = z.nullable(finite);
const nullableText = z.nullable(text);
const urgency = z.literal([1, 2, 3]);
/** A bed number: a whole number from 1. `Number.isInteger`, unlike `z.int()`, has no size cap. */
const bed = z.number().check(z.gte(1)).check(z.refine(Number.isInteger));
/** A link to another record: absent, null, or an id that `consistent` resolves. */
const link = z.optional(nullableText);
/** A list that a stored state must hold empty. */
const empty = z.array(z.unknown()).check(z.maxLength(0));
/** An object whose every value matches `value`; `consistent` checks the keys where they are ids. */
const entries = <T extends z.ZodMiniType>(value: T) => z.catchall(z.object({}), value);
const stamped = z.looseObject({ at: finite, by: text });
const distinctIds = (rows: readonly { id: string }[]) => new Set(rows.map((row) => row.id)).size === rows.length;
const id = text.check(z.minLength(1));

// Pass 1: rules for known keys at any depth. A history list holds rows with a finite time and the
// named text fields; a record key holds an object; a unit list holds strings.
const history = (shape: z.core.$ZodShape) => z.array(z.looseObject({ at: finite, ...shape }));
const legalFormExpiryCorrection = z
  .strictObject({
    at: finite,
    by: z.enum(Object.keys(WARD_FLOW_ROLE_LABELS) as [string, ...string[]]),
    formCode: id,
    formWrittenAt: z.optional(finite),
    previousDueAt: finite,
    dueAt: finite,
    reason: z.enum(PAPER_EXPIRY_CORRECTION_REASONS),
  })
  .check(z.refine((row) => row.previousDueAt !== row.dueAt));
const legalFormRule = z.looseObject({
  code: text,
  region: z.optional(z.enum(["metro", "country"])),
  ageBand: z.optional(z.enum(["adult", "under_18"])),
});
const medicalClearanceRule = z.looseObject({ cleared: bool, at: finite });
const closureRule = z.looseObject({ at: finite, outcome: text, reason: text });
const NESTED_KEY_RULES = new Map<string, z.ZodMiniType>([
  ["statusChanges", history({ from: text, to: text, by: text, reason: text })],
  ["urgencyChanges", history({ by: text, reason: text, from: urgency, to: urgency })],
  ["overrides", history({ by: text, reason: text, unitIds: strings })],
  ["declines", history({ unitId: text, reason: text })],
  ["withdrawnReferrals", history({ unitId: text, reason: text })],
  ["referralAnswerHistory", history({ unitId: text, answer: z.enum(["waitlisted", "declined", "withdrawn"]) })],
  ["unwinds", history({ kind: text, by: text, reason: text })],
  ["stageChanges", history({ to: text, by: text })],
  ["legalFormExpiryHistory", history({ by: text, basis: text })],
  ["legalFormExpiryCorrections", z.array(legalFormExpiryCorrection)],
  ["legalFormReceiptCorrections", history({ by: text, reason: text })],
  ["genderChanges", history({ by: text, to: text })],
  ["supersededExaminations", history({ outcome: text })],
  // Make Room and eligibility read `unitIds`; the tick is only ever stored as `true`.
  ["genderPlacements", history({ by: text, unitIds: strings, reason: text, wardChecked: z.literal(true) })],
  ...["destinations", "corrections", "urgentFlagHistory", "uploadedForms"].map((key) => [key, records] as const),
  ["legalForm", legalFormRule],
  ["medicalClearance", medicalClearanceRule],
  ["transportNeed", z.looseObject({ needed: bool, at: finite })],
  ["closure", closureRule],
  ...[
    "legalClock",
    "transport",
    "examination",
    "urgentFlag",
    "expectFlag",
    "referralAbsence",
    "arrivalDetails",
    "arrivalException",
    "legalMismatch",
    "escalation",
    "destination",
    "about",
    "actor",
    "subject",
    "details",
  ].map((key) => [key, record] as const),
  ...["referredUnitIds", "waitlistedUnitIds", "triedUnitIds", "closedBayIds", "intakeConstraints"].map(
    (key) => [key, strings] as const,
  ),
  ["atsCategory", z.literal([1, 2, 3, 4, 5])],
]);
const TIME_KEY = /^at$|At$|Minutes$/;

function isReferralIntakeCandidate(value: unknown): value is ReferralIntakeDetails {
  return (
    object(value) &&
    object(value.catchment) &&
    typeof value.reasonForReferral === "string" &&
    typeof value.legalStatus === "string" &&
    Array.isArray(value.riskFlags) &&
    object(value.medicalClearance) &&
    typeof value.triageAndRampCompleted === "boolean" &&
    Array.isArray(value.charts) &&
    typeof value.additionalDocuments === "boolean" &&
    object(value.referrer)
  );
}

/** Check nested containers before any screen or allocator can touch them. This is a recovery
 * fence, not a producer: a rejected payload is never repaired or mixed with fixture records. */
function nested(value: unknown, depth = 0): boolean {
  if (depth > 40) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => item !== null && nested(item, depth + 1));
  if (!object(value)) return false;
  for (const [key, item] of Object.entries(value)) {
    if (["__proto__", "constructor", "prototype"].includes(key)) return false;
    // A drawer referral's intake has its own shape (string times, a clearance with no `at`) and its
    // own validator, the one RECEIVE_REFERRAL applies. The generic walk below misread it and
    // refused every world holding one, so no such scenario could be saved (review finding A2-1).
    if (key === "intake") {
      if (!isReferralIntakeCandidate(item) || referralIntakeError(item) !== null) return false;
      continue;
    }
    const rule = NESTED_KEY_RULES.get(key);
    if (rule && !fits(rule, item)) return false;
    if (TIME_KEY.test(key) && !fits(nullableFinite, item)) return false;
    if (!nested(item, depth + 1)) return false;
  }
  return true;
}

// Pass 2: row shapes.

// D-38: a community treatment order is the one non-text patient field: Form 5A, a finite recorded
// time and a role label. D-40: earlier orders have each ended, and hold the same four facts and
// nothing else. Neither may carry another key.
const endedOrder = z.strictObject({ form: z.literal("5A"), recordedAt: finite, recordedBy: text, endedAt: finite });
const patient = z.catchall(
  z.object({
    id: text.check(z.regex(/^PT-/)),
    umrn: text,
    givenName: text,
    familyName: text,
    dateOfBirth: text.check(z.regex(/^\d{4}-\d{2}-\d{2}$/)),
    communityTreatmentOrder: z.optional(
      z.strictObject({
        form: z.literal("5A"),
        recordedAt: finite,
        recordedBy: text,
        endedAt: z.optional(finite),
        earlier: z.optional(z.array(endedOrder)),
      }),
    ),
    // v10 pass 2: `addedAt` is the one other non-text field, a finite instant when present.
    // Optional, so a save made before it existed loads unchanged; no storage version bump.
    addedAt: z.optional(finite),
    registrationScope: z.optional(
      z.strictObject({ kind: z.enum(["ed", "ward", "team", "site", "service"]), placeId: text }),
    ),
  }),
  // Every other patient field stays plain text.
  text,
);

const capacityFigure = z.looseObject({
  value: counter,
  confirmedAt: finite,
  staleAfterMinutes: counter,
  source: z.enum(["feed", "ward"]),
  revision: z.optional(counter),
  confirmations: z.optional(counter),
  confirmedBy: z.optional(z.enum(["ward", "bed_manager", "coordinator"])),
});
const unit = z
  .looseObject({
    id,
    siteCode: text,
    name: text,
    cohort: z.enum(COHORTS),
    sexDesignation: z.enum(["Undesignated", "Female only", "Male only"]),
    authorised: bool,
    forensic: bool,
    beds: counter,
    lockedBeds: counter,
    allocatableLocked: counter,
    held: counter,
    blocked: counter,
    speciallingCapacity: counter,
    highAcuityCapacity: counter,
    sexMix: z.looseObject({ Female: counter, Male: counter }),
    empty: capacityFigure,
    allocatable: capacityFigure,
    reservationReleaseCapacityConflicts: z.optional(
      z.array(
        z.looseObject({
          movementId: text,
          at: finite,
          admissionId: z.optional(id),
          allocatableBefore: counter,
          allocatableLockedBefore: counter,
          lockedBedReleased: bool,
        }),
      ),
    ),
    arrivalCapacityConflicts: z.optional(z.array(z.looseObject({ movementId: text, at: finite }))),
    isClosed: z.optional(bool),
    // Smart features idea 7: a chosen reason, never typed text.
    admissionsClosure: z.optional(
      z.looseObject({
        reason: z.enum(WARD_CLOSURE_REASONS.map((entry) => entry.id) as [WardClosureReason, ...WardClosureReason[]]),
        at: finite,
        by: text,
        until: z.optional(finite),
      }),
    ),
    // D-72: fixed-list choices, ids and typed times already read to instants. No typed text.
    restrictivePractice: z.optional(
      z.looseObject({
        episodes: z
          .array(
            z
              .looseObject({
                id: text,
                practice: z.enum(RESTRICTIVE_PRACTICE_IDS),
                admissionId: id,
                startedAt: finite,
                endedAt: z.optional(finite),
                recordedAt: finite,
                recordedBy: text,
              })
              .check(
                z.refine(
                  (episode) =>
                    episode.startedAt <= episode.recordedAt &&
                    (episode.endedAt === undefined || episode.endedAt >= episode.startedAt),
                ),
              ),
          )
          .check(z.refine(distinctIds)),
        incidents: z
          .array(
            z
              .looseObject({
                id: text,
                category: z.enum(WARD_INCIDENT_CATEGORY_IDS),
                at: finite,
                recordedAt: finite,
                recordedBy: text,
              })
              .check(z.refine((incident) => incident.at <= incident.recordedAt)),
          )
          .check(z.refine(distinctIds)),
        seclusionRoom: z.optional(
          z.looseObject({
            status: z.enum(SECLUSION_ROOM_STATUS_IDS),
            at: finite,
            by: text,
          }),
        ),
      }),
    ),
  })
  // CONFIRM_CAPACITY records an aggregate ward observation, which may disagree with the older feed
  // empty count and does not rewrite the separately recorded locked count. Each count is bounded
  // above; recovery must not invent a relationship the producer rejects.
  .check(
    z.refine(
      (unit) =>
        unit.empty.value <= unit.beds &&
        unit.allocatable.value <= unit.beds &&
        unit.lockedBeds <= unit.beds &&
        unit.allocatableLocked <= unit.lockedBeds &&
        unit.held + unit.blocked <= unit.beds &&
        // Release conflicts are bounded historical observations, not evidence of an arrival or a
        // reason to relax any count invariant.
        (unit.reservationReleaseCapacityConflicts ?? []).every(
          (conflict) =>
            conflict.allocatableBefore <= unit.beds &&
            conflict.allocatableLockedBefore <= unit.lockedBeds &&
            (conflict.allocatableBefore === unit.beds ||
              (conflict.lockedBedReleased && conflict.allocatableLockedBefore === unit.lockedBeds)),
        ),
    ),
  );

const turnaroundPriority = z.strictObject({ unitId: id, flaggedAt: finite, source: z.enum(["cld", "departure"]) });
// Smart features idea 5: a bed meeting action is chosen from fixed lists, never typed text.
// A ward owner always names its ward, and a done action records both when and by whom.
const meetingAction = z
  .strictObject({
    kind: z.enum(
      BED_MEETING_ACTION_KINDS.map((entry) => entry.id) as [BedMeetingActionKind, ...BedMeetingActionKind[]],
    ),
    owner: z.enum(BED_MEETING_ACTION_OWNERS),
    ownerUnitId: z.optional(text),
    dueAt: finite,
    recordedAt: finite,
    doneAt: z.optional(finite),
    doneBy: z.optional(text),
  })
  .check(z.refine((action) => (action.owner === "ward") === (action.ownerUnitId !== undefined)))
  .check(z.refine((action) => (action.doneAt === undefined) === (action.doneBy === undefined)));

// Fix plan item 10: a level from the fixed list, an Intermittent interval from the fixed list, and a
// review time as a number. `isObservation` is the same check `RECORD_OBSERVATION_LEVEL` makes.
const observationRule = z.custom<Observation>(isObservation);
const observationChangeRule = z.strictObject({ at: finite, from: observationRule, to: observationRule });

const movement = z
  .looseObject({
    id,
    originEdId: z.optional(text),
    // D-76: a journey from an accepted community referral starts at the referring team instead.
    originCommunity: z.optional(z.strictObject({ teamName: z.optional(text), siteCode: text })),
    turnaroundPriority: z.optional(turnaroundPriority),
    cohort: z.enum(COHORTS),
    security: z.enum(["Open", "Secure"]),
    sex: z.enum(RECORDED_SEXES),
    legalStatus: text,
    stage: z.enum(MOVEMENT_STAGES),
    owner: text,
    blocker: text,
    openedAt: finite,
    flaggedUrgent: bool,
    observation: observationRule,
    observationChanges: z.optional(z.array(observationChangeRule)),
    highAcuity: bool,
    urgency,
    statusChanges: records,
    urgencyChanges: records,
    overrides: records,
    declines: records,
    withdrawnReferrals: records,
    referralAnswerHistory: z.optional(records),
    unwinds: records,
    stageChanges: records,
    referredUnitIds: strings,
    transport: z.optional(z.looseObject({ id: text, provider: text, escortRequired: bool })),
    patientId: link,
    referralId: link,
    admissionId: link,
    sourceAdmissionId: link,
    acceptedUnitId: link,
    pullExpiresAt: z.optional(finite),
    extendedHoldAt: z.optional(finite),
    closure: z.optional(closureRule),
    // D-74: the community purpose that closed this record is one of the two listed values, or absent.
    communityPurpose: z.optional(z.custom(isCommunityReferralPurpose)),
    meetingActions: z.optional(z.array(meetingAction)),
    medicalClearance: z.optional(medicalClearanceRule),
    medicalDeterioration: z.optional(z.looseObject({ at: finite, by: z.literal("ed"), resumedAt: z.optional(finite) })),
  })
  // D-76: a journey starts at an ED or, from an accepted community referral, at the referring team.
  .check(z.refine((movement) => (movement.originEdId === undefined) !== (movement.originCommunity === undefined)))
  .check(
    z.refine((movement) => {
      const pause = movement.medicalDeterioration;
      if (pause === undefined) return true;
      if (pause.resumedAt !== undefined) return pause.resumedAt > pause.at;
      // An unresumed pause holds the referral before placement: nothing accepted, no bed pulled,
      // not medically cleared, and no live transport.
      return (
        movement.acceptedUnitId === undefined &&
        movement.admissionId === undefined &&
        movement.stage === "placement_requested" &&
        movement.medicalClearance?.cleared === false &&
        (movement.transport === undefined || movement.transport.cancelledAt !== undefined)
      );
    }),
  );

const admission = z.looseObject({
  id,
  unitId: text,
  meetingActions: z.optional(z.array(meetingAction)),
  state: z.enum(["waitlisted", "pulled", "occupied", "departed"]),
  observation: observationRule,
  observationChanges: z.optional(z.array(observationChangeRule)),
  highAcuity: bool,
  sex: text,
  // R7 / counts follow gender (25 September 2026): optional; absent in older saves, which load as they are.
  gender: z.optional(z.enum(REFERRAL_GENDERS)),
  dischargeDateMoves: counter,
  // v10 pass 2 (Bed board): optional, a whole bed on the stay's own unit when present.
  bedNumber: z.optional(bed),
  pulledAt: nullableFinite,
  arrivedAt: nullableFinite,
  awayAtEmergencyDepartmentSince: nullableFinite,
  expectedDischargeAt: nullableFinite,
  dischargeDateSetAt: nullableFinite,
  dischargeConfirmedAt: nullableFinite,
  leftAt: nullableFinite,
  patientId: nullableText,
  referralId: nullableText,
  movementId: nullableText,
  plannedLegalStatus: z.optional(z.custom(isPlannedAdmissionLegalStatus)),
  homeRegion: nullableText,
  dischargeDateSetBy: nullableText,
  dischargeConfirmedBy: nullableText,
  blockReason: z.nullable(z.enum(BED_RELEASE_BLOCKERS)),
  leavingDestination: z.nullable(z.custom(isLeavingDestination)),
  // A stored barrier is a list value or absent; free text here would be typed text restored from
  // storage (review finding A2-2).
  dischargeBarrier: z.optional(z.nullable(z.custom(isDischargeBarrier))),
  // FD-10: the ward's own block, a listed block with a finite time, or absent in older saves.
  wardDiagnosis: z.optional(
    z.looseObject({
      block: z.custom((value) => typeof value === "string" && isTentativeDiagnosisBlock(value)),
      recordedAt: finite,
      recordedBy: text,
    }),
  ),
  // Browser storage holds fixed-list criteria with finite times. A typed patient specific criterion
  // is held only as the device copy's stand-in, never its words (D-60, D-65, D-72).
  dischargeCriteria: z.optional(z.nullable(z.custom(isDeviceCopyDischargeCriteriaRecord))),
  careJourney: z.optional(z.custom(validCareJourney)),
  followUp: z.nullable(
    z.looseObject({ state: z.enum(["arranged", "not_arranged"]), recordedAt: finite, recordedBy: text }),
  ),
});

// A destination is one of three kinds, each holding its own facts; any other kind is refused.
const referralDestination = z.discriminatedUnion("kind", [
  z.looseObject({
    kind: z.literal("psychiatric_ward"),
    sex: text,
    secureBedNeeded: bool,
    involuntaryBedNeeded: bool,
    highAcuityNursingNeeded: bool,
  }),
  z.looseObject({ kind: z.literal("community_team"), teamName: text }),
  z.looseObject({ kind: z.literal("emergency_department"), edId: text, purpose: text }),
]);
// A ward's ask is a fixed item and two role labels; a tick-off carries both its time and its role.
const informationNeed = z
  .strictObject({
    need: text.check(z.refine((need) => (REFERRAL_INFORMATION_NEED_IDS as readonly string[]).includes(need))),
    at: finite,
    by: text,
    metAt: z.optional(finite),
    metBy: z.optional(text),
  })
  .check(z.refine((entry) => (entry.metAt === undefined) === (entry.metBy === undefined)));
// Fix plan item 4: an owner is a listed desk and a call a listed outcome, both with a time and the
// role that recorded them. Strict, so no typed field can ride along on a restored entry.
const referralOwnerEntry = z.strictObject({ owner: z.enum(REFERRAL_OWNER_DESKS), at: finite, by: text });
const referralContactEntry = z.strictObject({
  contact: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("psychiatric_ward"), unitId: text }),
    z.strictObject({ kind: z.literal("community_team"), teamId: text }),
    z.strictObject({ kind: z.literal("referrer") }),
  ]),
  outcome: text.check(z.refine((outcome) => (REFERRAL_CONTACT_OUTCOME_IDS as readonly string[]).includes(outcome))),
  at: finite,
  by: text,
});
const referral = z.looseObject({
  id,
  submissionId: z.optional(text.check(z.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))),
  turnaroundPriority: z.optional(turnaroundPriority),
  ageBand: text,
  homeRegion: text,
  source: text,
  originSiteCode: text,
  history: text,
  raisedAt: finite,
  transportNeeded: bool,
  urgency,
  suburb: z.union([
    z.looseObject({ kind: z.literal("named"), name: text }),
    z.looseObject({ kind: z.literal("unknown"), reason: z.literal("not_known") }),
  ]),
  destinations: z.array(
    z.looseObject({
      destination: referralDestination,
      state: z.enum(REFERRAL_ADDRESSING_STATES),
      acceptedUnitId: link,
      openedAt: z.optional(finite),
      informationNeeds: z.optional(z.array(informationNeed)),
    }),
  ),
  patientId: link,
  originUnitId: link,
  ownerHistory: z.optional(z.array(referralOwnerEntry)),
  contactLog: z.optional(z.array(referralContactEntry)),
});

const bedRelease = z.looseObject({
  id,
  unitId: text,
  admissionId: text,
  state: z.enum(BED_RELEASE_STATES),
  expectedAt: finite,
  confirmedAt: finite,
  confirmedBy: text,
  preparing: bool,
  // #398: each service is notified at most once.
  supportNoticesSent: z.optional(
    z
      .array(z.looseObject({ service: z.enum(SUPPORT_SERVICE_TYPES), at: finite, by: text }))
      .check(z.refine((sent) => new Set(sent.map((notice) => notice.service)).size === sent.length)),
  ),
});

// D-38: an absence holds when it was recorded and the time of each fixed missing person step, and
// only those two fixed fields: a restored absence must carry no free text. Each step is done once,
// no earlier than the absence began.
const absence = z
  .strictObject({ since: finite, steps: z.array(z.strictObject({ step: z.enum(ABSENCE_STEPS), at: finite })) })
  .check(
    z.refine(
      (absence) =>
        absence.steps.every((done) => done.at >= absence.since) &&
        new Set(absence.steps.map((done) => done.step)).size === absence.steps.length,
    ),
  );
const leaveBed = z.looseObject({
  id,
  unitId: text,
  admissionId: text,
  expectedReturn: finite,
  confirmedAt: finite,
  confirmedBy: text,
  absentWithoutLeave: z.optional(absence),
});

const refreshRequest = z.looseObject({
  id: z.optional(text),
  unitId: text,
  at: finite,
  byRole: text,
  confirmations: z.optional(counter),
});
const distinctRefreshRequestIds = (rows: readonly { id?: string }[]) => {
  const ids = rows.flatMap((row) => (row.id === undefined ? [] : [row.id]));
  return new Set(ids).size === ids.length;
};

const auditEvent = z
  .looseObject({
    id,
    sequence: counter.check(z.gte(1)),
    generation: counter,
    at: nullableFinite,
    actor: record,
    subject: record,
    details: record,
    action: text,
    category: text,
  })
  .check(
    z.refine(
      (row) =>
        (row.action !== "OPEN_DISCHARGE_RECORD" ||
          row.details.requestNamespace === undefined ||
          validDischargeRequestNamespace(row.details.requestNamespace)) &&
        (row.action !== "RECORD_ADMISSION_CARE" ||
          (row.details.kind === "care" &&
            (row.details.recorded === undefined ||
              row.details.recorded === null ||
              validCareChange(row.details.recorded)))),
    ),
  );

const broadcastAlert = z.looseObject({
  id,
  title: text,
  message: text,
  targetScopeLabel: text,
  dispatchedByRole: text,
  dispatchedByName: text,
  severity: z.enum(["critical", "warning", "advisory"]),
  category: z.enum([
    "capacity_gridlock",
    "ed_surge",
    "unit_closure",
    "transport_delay",
    "clinical_stream",
    "statutory_advisory",
  ]),
  targetScope: z.enum(["all", "metro_adult", "ed_liaison", "forensic", "adolescent", "older_adult", "regional_wachs"]),
  status: z.enum(["active", "stood_down", "expired"]),
  dispatchedAt: finite,
  expiresAt: finite,
  durationMinutes: finite.check(z.positive()),
  acknowledgedUnits: strings,
  // Global alerts, 10 Oct 2026: every new field is optional, so a version 7 save restores.
  kind: z.optional(z.enum(["directive", "bed_call", "pull_now"])),
  replies: z.optional(
    z.array(
      // The banner looks up each answer and reason label, so an unknown one is refused here.
      z.looseObject({
        unitId: text,
        answer: z.string().check(z.refine((answer) => Object.hasOwn(BROADCAST_ANSWER_LABELS, answer))),
        at: finite,
        reason: z.optional(z.enum(REFERRAL_DECLINE_REASONS)),
        beds: z.optional(finite),
        readyAt: z.optional(finite),
      }),
    ),
  ),
  movementId: z.optional(text),
  targetUnitIds: z.optional(strings),
  answerBy: z.optional(finite),
  // A count past the movement's history would hide a later pull; `consistent` bounds it.
  stageChangesAtDispatch: z.optional(z.number().check(z.nonnegative()).check(z.refine(Number.isInteger))),
});

// Stream D: a planned admission names a real ward, chooses every category from its fixed list, and
// names either an existing patient or one to three initials. Only an arrived booking names an
// admission, and only a cancelled one has a cancel reason.
const plannedAdmission = z
  .looseObject({
    id,
    unitId: text,
    state: z.enum(PLANNED_ADMISSION_STATES),
    reason: z.custom(isPlannedAdmissionReason),
    legalStatus: z.custom(isPlannedAdmissionLegalStatus),
    ageBand: z.enum(COHORTS),
    sex: z.enum(RECORDED_SEXES),
    // Gender (9 Oct 2026) is optional: a v7 save made before bookings kept it has none.
    gender: z.optional(z.enum(REFERRAL_GENDERS)),
    expectedStayDays: z.custom(isPlannedAdmissionStayDays),
    expectedArrivalAt: finite,
    bookedAt: finite,
    bookedBy: text,
    changedAt: nullableFinite,
    changeCount: counter,
    cancelledAt: nullableFinite,
    cancelReason: z.nullable(z.custom(isPlannedAdmissionCancelReason)),
    convertedAt: nullableFinite,
    patientId: nullableText,
    // Typed initials are held only as the device copy's placeholder (D-72), never the letters.
    initials: z.nullable(
      z.union([z.literal(TYPED_TEXT_NOT_KEPT), text.check(z.regex(PLANNED_ADMISSION_INITIALS_PATTERN))]),
    ),
    admissionId: nullableText,
  })
  .check(
    z.refine(
      (row) =>
        (row.patientId === null) !== (row.initials === null) &&
        (row.state === "arrived" || row.admissionId === null) &&
        (row.state === "cancelled") === (row.cancelReason !== null),
    ),
  );

const auditReview = z.looseObject({ id, eventId: text, at: finite, generation: counter });

// v10 pass 2: undo records are optional (absent is none). Each holds only the shapes the reducer
// writes; `consistent` checks that it names a real subject.
const STEP_ACTIONS = new Map<string, readonly string[]>(Object.entries(UNDO_STEP_ACTIONS));
const undoRow = {
  at: finite,
  role: z.enum(["coordinator", "ed", "ward", "officer", "demo", "community", "bed_manager", "executive"]),
};
const undoRecord = z.discriminatedUnion("kind", [
  z
    .looseObject({
      ...undoRow,
      kind: z.literal("referral-decision"),
      referralId: text,
      action: z.enum(["ACCEPT_REFERRAL", "DECLINE_REFERRAL"]),
      unitId: nullableText,
      // A referral snapshot is checked by the generic walk.
      before: record,
      after: record,
      noticeIds: strings,
    })
    .check(z.refine((row) => row.before.id === row.referralId && row.after.id === row.referralId)),
  z.looseObject({
    ...undoRow,
    kind: z.literal("bed-placement"),
    admissionId: text,
    unitId: text,
    beforeBed: z.nullable(bed),
    beforeMovementBed: z.optional(z.nullable(bed)),
    beforeReferralBed: z.optional(z.nullable(bed)),
    afterBed: bed,
    bedKindChange: z.optional(
      z.looseObject({
        before: z.nullable(z.enum(["locked", "open"])),
        after: z.enum(["locked", "open"]),
        lockedBefore: counter,
        lockedAfter: counter,
        capacityRevision: counter,
      }),
    ),
  }),
  z
    .looseObject({
      ...undoRow,
      kind: z.literal("step"),
      undoType: text,
      action: text,
      subjectId: text,
      seq: z.optional(counter),
      unitId: nullableText,
      // v10 pass 3: a step's before/after rows are state rows, already walked by `nested`.
      changes: z.array(
        z.discriminatedUnion("mode", [
          z.looseObject({ slice: text, mode: z.literal("id"), id: text, index: counter, before: z.unknown() }),
          z.looseObject({ slice: text, mode: z.literal("append"), start: counter, rows: z.array(z.unknown()) }),
          z.looseObject({ slice: text, mode: z.literal("whole"), before: z.unknown() }),
        ]),
      ),
    })
    .check(z.refine((row) => STEP_ACTIONS.get(row.undoType)?.includes(row.action) === true)),
]);

const notice = z.looseObject({ id, raisedAt: finite, to: record, about: record, kind: text, sentence: text });

// Since 21 Oct 2026 (D-72) the device copy of a session that holds typed text keeps repatriations and
// carer, PSP and MHAS notifications, with every typed value as the placeholder. These closed shapes
// mirror `isValidSharedWardFlowState`, but a typed field must hold the placeholder: the typed words
// themselves are still refused (D-18).
const notKept = z.literal(TYPED_TEXT_NOT_KEPT);
const role = z.enum(Object.keys(WARD_FLOW_ROLE_LABELS) as [string, ...string[]]);
const repatriation = z
  .strictObject({
    admissionId: id,
    at: finite,
    estimatedAt: finite,
    by: role,
    // Membership is checked against the saved scenario below; other text is still refused.
    homeHospital: text,
    cadNumber: notKept,
    receivingWardAgreed: bool,
    mode: z.enum(REPATRIATION_MODES),
    provider: z.enum(TRANSPORT_PROVIDERS),
    transportLegalStatus: z.enum(TRANSPORT_LEGAL_STATUSES),
    // A plan agreed after it was first logged also carries both of these.
    agreedAt: z.optional(finite),
    agreedBy: z.optional(role),
  })
  .check(z.refine((row) => (row.agreedAt === undefined) === (row.agreedBy === undefined)));
const supportNotification = z.strictObject({
  id,
  occasion: z.enum(SUPPORT_NOTIFICATION_OCCASIONS),
  subjectId: id,
  party: z.enum(SUPPORT_NOTIFICATION_PARTIES),
  outcome: z.enum(SUPPORT_NOTIFICATION_OUTCOMES),
  // Told carries who and when; not applicable carries the reason (`typedRecordsResolve`).
  who: z.optional(notKept),
  contactedAt: z.optional(finite),
  reason: z.optional(notKept),
  at: finite,
  by: role,
});

/**
 * Each kept repatriation and notification names a real record, a told record carries who and when
 * (no later than the record) and no reason, and a not applicable one carries only the reason.
 */
function typedRecordsResolve(
  state: Pick<WardFlowState, "admissions" | "movements" | "repatriations"> & {
    supportNotifications?: WardFlowState["supportNotifications"];
  },
): boolean {
  const admissionIds = new Set(state.admissions.map((admission) => admission.id));
  const movementIds = new Set(state.movements.map((movement) => movement.id));
  return (
    state.repatriations.every((row) => admissionIds.has(row.admissionId)) &&
    (state.supportNotifications ?? []).every(
      (row) =>
        (row.occasion === "discharge" ? admissionIds : movementIds).has(row.subjectId) &&
        (row.outcome === "told"
          ? row.who !== undefined && row.contactedAt! <= row.at && row.reason === undefined
          : row.reason !== undefined && row.who === undefined && row.contactedAt === undefined),
    )
  );
}

const storedState = z.looseObject({
  auditEvents: z.array(auditEvent).check(z.refine(distinctIds)),
  auditReviews: z.array(auditReview).check(z.refine(distinctIds)),
  movements: z.array(movement).check(z.refine(distinctIds)),
  units: z.array(unit).check(z.refine(distinctIds)),
  // Refusals are never written (the provider saves `rejections: []`, Josh D-18, 25 Sept 2026,
  // because a refusal can quote a caller-supplied id); refusing a stored one is the second fence.
  rejections: empty,
  bedReleases: z.array(bedRelease).check(z.refine(distinctIds)),
  leaveBeds: z.array(leaveBed).check(z.refine(distinctIds)),
  refreshRequests: z.array(refreshRequest).check(z.refine(distinctRefreshRequestIds)),
  referrals: z.array(referral).check(z.refine(distinctIds)),
  patients: z.array(patient).check(z.refine(distinctIds)),
  admissions: z.array(admission).check(z.refine(distinctIds)),
  notices: z.array(notice).check(z.refine(distinctIds)),
  // One record per admission, as the reducer keeps it.
  repatriations: z
    .array(repatriation)
    .check(z.refine((rows) => new Set(rows.map((row) => row.admissionId)).size === rows.length)),
  supportNotifications: z.optional(z.array(supportNotification).check(z.refine((rows) => distinctIds(rows)))),
  handoverSignOffs: z.array(stamped),
  clinicalContacts: z.array(
    z.extend(stamped, { teamId: text.check(z.refine((teamId) => communityTeamById(teamId) !== null)) }),
  ),
  broadcastAlerts: z.array(broadcastAlert).check(z.refine(distinctIds)),
  plannedAdmissions: z.array(plannedAdmission).check(z.refine(distinctIds)),
  undoRecords: z.optional(z.array(undoRecord)),
  worldGeneration: counter,
  auditSequence: counter,
  auditReviewSequence: counter,
  referralSequence: counter,
  leaveBedSequence: counter,
  frontDoorReferralSequence: counter,
  patientSequence: counter,
  admissionSequence: counter,
  broadcastSequence: counter,
  plannedAdmissionSequence: counter,
  auditCaptureStartedAt: finite,
  clockOffsetMinutes: finite,
  scenario: z.enum(WARD_SCENARIOS),
  dischargeRevisions: entries(counter),
  inboxAcknowledgements: entries(z.array(stamped)),
  inboxCompletions: entries(z.array(z.extend(stamped, { kind: z.enum(["completed", "reopened"]) }))),
  // Stream A, 9 Oct 2026: added without a storage version bump, so a save made before them has
  // neither. Absent is valid and restores as empty (`withInboxStreamADefaults`); present must be valid.
  inboxOwnership: z.optional(entries(z.array(stamped))),
  inboxSnoozes: z.optional(
    entries(
      z.array(
        z.union([
          z.extend(stamped, { kind: z.literal("returned") }),
          z.extend(stamped, { kind: z.literal("snoozed"), until: finite, reason: z.custom(isSnoozeReason) }),
        ]),
      ),
    ),
  ),
  morningRollupConfirmations: entries(
    z.looseObject({ confirmedAt: finite, confirmedByRole: text, expectedDischarges: counter }),
  ),
});
type StoredState = z.infer<typeof storedState>;

/** Identity membership belongs to the saved world, before that world becomes the active network. */
function identitiesMatchScenario(state: StoredState): boolean {
  const sites = scenarioWardNetwork(state.scenario).sites;
  const siteCodes = new Set(sites.map((site) => site.code));
  const edIds = new Set(sites.flatMap((site) => (site.emergencyDepartment ? [site.emergencyDepartment.id] : [])));
  return (
    state.units.every((unit) => siteCodes.has(unit.siteCode)) &&
    state.movements.every(
      (movement) =>
        (movement.originEdId === undefined || edIds.has(movement.originEdId)) &&
        (movement.originCommunity === undefined || siteCodes.has(movement.originCommunity.siteCode)),
    ) &&
    state.referrals.every((referral) =>
      referral.destinations.every(
        ({ destination }) => destination.kind !== "emergency_department" || edIds.has(destination.edId),
      ),
    ) &&
    state.repatriations.every((row) => siteCodes.has(row.homeHospital)) &&
    state.patients.every(({ registrationScope }) => {
      if (registrationScope === undefined) return true;
      if (registrationScope.kind === "ed") return edIds.has(registrationScope.placeId);
      if (registrationScope.kind === "site") return siteCodes.has(registrationScope.placeId);
      return isPatientRegistrationScope(registrationScope, state.units);
    })
  );
}

// Pass 3: links between rows. Ids are already unique within each collection.
function consistent(state: StoredState, value: RecordValue): boolean {
  if (!identitiesMatchScenario(state)) return false;
  if (validateConfiguration(value.configuration) === null) return false;
  const submissionIds = state.referrals.flatMap((referral) =>
    referral.submissionId === undefined ? [] : [referral.submissionId],
  );
  if (new Set(submissionIds).size !== submissionIds.length) return false;
  const runtimeSequences: [readonly { id: string }[], RegExp, number][] = [
    [state.patients, /^PT-A(\d+)$/, state.patientSequence],
    [state.admissions, /^AD-ARR-(\d+)$/, state.admissionSequence],
    [state.movements, /^WF-9(\d+)$/, state.referralSequence],
    [state.referrals, /^RF-9(\d+)$/, state.frontDoorReferralSequence],
    [state.leaveBeds, /^WL-9(\d+)$/, state.leaveBedSequence],
    [state.broadcastAlerts, /^BCAST-(\d+)$/, state.broadcastSequence],
    [state.plannedAdmissions, /^PA-(\d+)$/, state.plannedAdmissionSequence],
  ];
  for (const [rows, pattern, sequence] of runtimeSequences) {
    for (const row of rows) {
      const match = pattern.exec(row.id);
      if (match && Number(match[1]) > sequence) return false;
    }
  }
  const ids = (rows: readonly { id: string }[]) => new Set<unknown>(rows.map((row) => row.id));
  const unitIds = ids(state.units),
    patientIds = ids(state.patients),
    movementIds = ids(state.movements),
    referralIds = ids(state.referrals),
    admissionIds = ids(state.admissions),
    auditIds = ids(state.auditEvents);
  const reference = (target: string | null | undefined, targets: Set<unknown>) =>
    target === undefined || target === null || targets.has(target);
  const movementById = new Map(state.movements.map((movement) => [movement.id, movement]));
  const admissionById = new Map(state.admissions.map((admission) => [admission.id, admission]));
  const stateUnitById = new Map(state.units.map((unit) => [unit.id, unit]));
  const referralById = new Map(state.referrals.map((referral) => [referral.id, referral]));

  for (const unit of state.units) {
    // Ward history remains here after a stay departs or moves elsewhere. Resolve the stay without
    // requiring its current ward/state, or imposing today's time window on retained episodes.
    if (unit.restrictivePractice?.episodes.some((episode) => !admissionIds.has(episode.admissionId))) return false;
    // A movement can later be re-pulled (including reusing its admission id), so current
    // placement/admission presence cannot invalidate a release conflict's history.
    const releasedMovementIds = new Set<string>();
    for (const conflict of unit.reservationReleaseCapacityConflicts ?? []) {
      if (!movementIds.has(conflict.movementId) || releasedMovementIds.has(conflict.movementId)) return false;
      releasedMovementIds.add(conflict.movementId);
    }
    const conflicts = unit.arrivalCapacityConflicts;
    const seen = new Set<string>();
    for (const conflict of conflicts ?? []) {
      if (seen.has(conflict.movementId)) return false;
      seen.add(conflict.movementId);
      const movement = movementById.get(conflict.movementId);
      if (
        !movement ||
        movement.acceptedUnitId !== unit.id ||
        movement.stage !== "arrived" ||
        movement.closure?.outcome !== "arrived" ||
        movement.closure.at !== conflict.at ||
        movement.admissionId !== conflict.admissionId
      )
        return false;
      if (conflict.admissionId !== undefined) {
        const admission = movement.admissionId == null ? undefined : admissionById.get(movement.admissionId);
        if (
          !admission ||
          admission.unitId !== unit.id ||
          admission.state !== "occupied" ||
          (admission.movementId !== movement.id &&
            !(admission.movementId === null && !admission.id.startsWith("AD-ARR-"))) ||
          admission.arrivedAt !== conflict.at
        )
          return false;
      }
    }
    // Keep the actual arrival and its bounded count disagreement recoverable. This never says
    // how many physical overflow beds exist; only a corroborated arrival can explain this excess.
    if (unit.sexMix.Female + unit.sexMix.Male > unit.beds + (conflicts?.length ?? 0)) return false;
  }

  for (const movement of state.movements) {
    if (
      !reference(movement.turnaroundPriority?.unitId, unitIds) ||
      !reference(movement.patientId, patientIds) ||
      !reference(movement.referralId, referralIds) ||
      !reference(movement.admissionId, admissionIds) ||
      !reference(movement.sourceAdmissionId, admissionIds) ||
      !reference(movement.acceptedUnitId, unitIds) ||
      !movement.referredUnitIds.every((unitId) => unitIds.has(unitId))
    )
      return false;
  }
  for (const admission of state.admissions) {
    const ward = stateUnitById.get(admission.unitId);
    if (!ward || (admission.bedNumber !== undefined && admission.bedNumber > ward.beds)) return false;
    if (
      !reference(admission.patientId, patientIds) ||
      !reference(admission.referralId, referralIds) ||
      !reference(admission.movementId, movementIds)
    )
      return false;
  }

  const samePatient = (left: { patientId?: string | null }, right: { patientId?: string | null } | undefined) =>
    !left.patientId || !right?.patientId || left.patientId === right.patientId;
  for (const movement of state.movements) {
    const admission = movement.admissionId == null ? undefined : admissionById.get(movement.admissionId);
    if (movement.admissionId !== undefined) {
      if (
        !admission ||
        admission.unitId !== movement.acceptedUnitId ||
        (admission.movementId !== movement.id &&
          !(admission.movementId === null && !admission.id.startsWith("AD-ARR-"))) ||
        (movement.patientId !== undefined && admission.patientId !== movement.patientId)
      )
        return false;
      if (movement.closure?.outcome === "arrived") {
        if (admission.state !== "occupied" && admission.state !== "departed") return false;
      } else if (admission.state !== "pulled") return false;
    }
    const referral = movement.referralId == null ? undefined : referralById.get(movement.referralId);
    if (!samePatient(movement, referral) || !samePatient(movement, admission)) return false;
  }
  for (const admission of state.admissions) {
    const movement = admission.movementId === null ? undefined : movementById.get(admission.movementId);
    // Seed admissions deliberately have movementId=null. Runtime destination stays must have
    // the reciprocal link; sending/source stays keep their own original movement link.
    if (admission.movementId !== null && (admission.state === "pulled" || admission.state === "occupied")) {
      if (!movement || movement.admissionId !== admission.id) return false;
    }
    const referral = admission.referralId === null ? undefined : referralById.get(admission.referralId);
    if (!samePatient(admission, movement) || !samePatient(admission, referral)) return false;
  }

  for (const referral of state.referrals) {
    if (!reference(referral.turnaroundPriority?.unitId, unitIds)) return false;
    if (!reference(referral.patientId, patientIds) || !reference(referral.originUnitId, unitIds)) return false;
    if (!referral.destinations.every((arm) => reference(arm.acceptedUnitId, unitIds))) return false;
    // D-74: a stored community purpose is one of the two listed values, or absent.
    const purposes = referral.destinations.flatMap((arm) =>
      arm.destination.kind === "community_team" && arm.destination.purpose !== undefined
        ? [arm.destination.purpose]
        : [],
    );
    if (!purposes.every(isCommunityReferralPurpose)) return false;
  }
  for (const rows of [state.bedReleases, state.leaveBeds, state.refreshRequests]) {
    for (const row of rows) if (!unitIds.has(row.unitId)) return false;
  }

  // Owner decision 2026-09-25: a bed release names the admission it belongs to, exactly one real
  // admission on the same unit. The reducer's own refusals (FLAG_BED_RELEASE, RELEASE_BED) are
  // mirrored here so a hand-edited or stale save cannot carry a release the current reducer could
  // never have produced: a live release names an occupied stay, at most one per stay, and a
  // discharged release names a departed one.
  const liveReleaseCountByAdmission = new Map<string, number>();
  for (const row of state.bedReleases) {
    if (row.state !== "discharged") {
      liveReleaseCountByAdmission.set(row.admissionId, (liveReleaseCountByAdmission.get(row.admissionId) ?? 0) + 1);
    }
  }
  for (const row of state.bedReleases) {
    const linkedAdmission = admissionById.get(row.admissionId);
    if (!linkedAdmission || linkedAdmission.unitId !== row.unitId) return false;
    if (row.state === "discharged") {
      if (linkedAdmission.state !== "departed") return false;
    } else {
      if (linkedAdmission.state !== "occupied") return false;
      if ((liveReleaseCountByAdmission.get(row.admissionId) ?? 0) > 1) return false;
    }
  }
  // Owner ruling 2026-09-25: a leave bed names the stay it belongs to, mirrored from the
  // reducer's RECORD_LEAVE_BED refusals: a real, occupied admission on the same unit, at most one
  // leave per stay.
  const leaveCountByAdmission = new Map<string, number>();
  for (const row of state.leaveBeds) {
    leaveCountByAdmission.set(row.admissionId, (leaveCountByAdmission.get(row.admissionId) ?? 0) + 1);
  }
  for (const row of state.leaveBeds) {
    const onLeave = admissionById.get(row.admissionId);
    if (!onLeave || onLeave.unitId !== row.unitId || onLeave.state !== "occupied") return false;
    if ((leaveCountByAdmission.get(row.admissionId) ?? 0) > 1) return false;
  }

  // `appendAudit` (ward-audit.ts) numbers rows from 1 and stores the newest number as
  // `auditSequence`, so issued numbers run 1..auditSequence INCLUSIVE; refusing the newest row
  // would make no audited day restorable (tests/ward-flow-recovery-audit-sequence.dom.test.tsx).
  if (state.auditEvents.some((row) => row.sequence > state.auditSequence)) return false;

  for (const row of state.broadcastAlerts) {
    if (row.stageChangesAtDispatch === undefined) continue;
    const dispatchedFor = row.movementId === undefined ? undefined : movementById.get(row.movementId);
    if (row.stageChangesAtDispatch > (dispatchedFor?.stageChanges.length ?? Infinity)) return false;
  }

  // An arrived booking names the admission it became: that admission is on the booking's ward and
  // carries the booking's own patient link (none for initials only). A later departure leaves both
  // facts true.
  for (const row of state.plannedAdmissions) {
    if (!unitIds.has(row.unitId) || (row.patientId !== null && !patientIds.has(row.patientId))) return false;
    if (row.state === "arrived") {
      const becameAdmission = row.admissionId === null ? undefined : admissionById.get(row.admissionId);
      if (
        becameAdmission === undefined ||
        becameAdmission.unitId !== row.unitId ||
        becameAdmission.patientId !== row.patientId
      )
        return false;
    }
  }

  // v10 pass 2: a review may name a synthetic seeded governance entry, derived from this same state.
  // The shape is fully checked by now; the seed reads it as the reducer's own state.
  const isGovernanceSeedReadableState = (candidate: RecordValue): candidate is RecordValue & WardFlowState =>
    typeof candidate.auditCaptureStartedAt === "number" &&
    Array.isArray(candidate.units) &&
    Array.isArray(candidate.movements) &&
    Array.isArray(candidate.referrals) &&
    Array.isArray(candidate.admissions);
  const seededAuditIds = new Set(
    (isGovernanceSeedReadableState(value) ? syntheticGovernanceAuditEvents(value) : []).map((e) => e.id),
  );
  for (const row of state.auditReviews)
    if (!auditIds.has(row.eventId) && !seededAuditIds.has(row.eventId) && !row.eventId.startsWith("audit-seed-"))
      return false;

  for (const row of state.undoRecords ?? []) {
    if (row.kind === "bed-placement") {
      if (!admissionIds.has(row.admissionId) || !unitIds.has(row.unitId)) return false;
      const ward = stateUnitById.get(row.unitId)!;
      if (row.bedKindChange) {
        const change = row.bedKindChange;
        const priorKind =
          change.before ??
          (row.beforeBed === null
            ? ward.lockedBeds === 0
              ? "open"
              : ward.lockedBeds === ward.beds
                ? "locked"
                : undefined
            : numberedBedKind(ward, row.beforeBed));
        if (
          priorKind === undefined ||
          change.after !== numberedBedKind(ward, row.afterBed) ||
          change.lockedBefore > ward.lockedBeds ||
          change.lockedAfter > ward.lockedBeds ||
          change.lockedAfter !==
            change.lockedBefore + Number(priorKind === "locked") - Number(change.after === "locked")
        )
          return false;
      }
      continue;
    }
    if (row.unitId !== null && !unitIds.has(row.unitId)) return false;
    if (row.kind === "referral-decision" && !referralIds.has(row.referralId)) return false;
  }

  for (const key of Object.keys(state.dischargeRevisions)) if (!admissionIds.has(key)) return false;
  for (const key of Object.keys(state.morningRollupConfirmations)) if (!unitIds.has(key)) return false;
  return true;
}

export function isValidStoredWardFlowState(value: unknown): value is WardFlowState {
  if (!object(value) || !nested(value)) return false;
  const parsed = storedState.safeParse(value);
  return parsed.success && consistent(parsed.data, value) && typedRecordsResolve(value as unknown as WardFlowState);
}

/**
 * A validated stored state with the stream A inbox records filled in when the save predates them,
 * reviews of seeded governance entries moved to ids that name their subject, and decline reasons
 * saved before the one decline list read as merged ones (D-78, `ward-decline-legacy.ts`).
 * Call after `isValidStoredWardFlowState` on every restore path.
 */
export function withInboxStreamADefaults<T extends WardFlowState>(state: T): T {
  const stored = state as T & Partial<Pick<WardFlowState, "inboxOwnership" | "inboxSnoozes">>;
  return withSeededReviewIds({
    ...upgradeLegacyDeclineReasons(state),
    inboxOwnership: stored.inboxOwnership ?? {},
    inboxSnoozes: stored.inboxSnoozes ?? {},
  });
}

/**
 * Seeded entries once had fixed ids (`audit-seed-legal-status`). They were derived from the first
 * records of this same state, so a review saved under one, and the audit rows recording that review
 * or its undo, move to the entry's current id (`audit-seed-legal-status:<movement id>`). The entry
 * then stays shown as reviewed, with its review history.
 */
function withSeededReviewIds<T extends WardFlowState>(state: T): T {
  const legacy = (eventId: string) => /^audit-seed-[a-z-]+$/.test(eventId);
  if (
    !state.auditReviews.some((review) => legacy(review.eventId)) &&
    !state.auditEvents.some((event) => event.subject.kind === "audit-event" && legacy(event.subject.eventId))
  )
    return state;
  const seeded = syntheticGovernanceAuditEvents(state);
  const current = (eventId: string) =>
    legacy(eventId) ? (seeded.find((entry) => entry.id.startsWith(`${eventId}:`))?.id ?? eventId) : eventId;
  return {
    ...state,
    auditReviews: state.auditReviews.map((review) => ({ ...review, eventId: current(review.eventId) })),
    auditEvents: state.auditEvents.map((event) =>
      event.subject.kind === "audit-event"
        ? { ...event, subject: { ...event.subject, eventId: current(event.subject.eventId) } }
        : event,
    ),
  };
}

/**
 * The stored state version this build writes. A save at an older version restores only through
 * `migrateStoredWardFlowState`; every other mismatch is refused.
 */
export const WARD_FLOW_STORED_STATE_VERSION = 7;

/**
 * Brings a stored state saved at `fromVersion` up to the current shape, or returns null when no
 * migration exists. The result still goes through `isValidStoredWardFlowState`: a migration adds
 * the newer version's fields, it never repairs or vouches for anything the save already held.
 *
 * v6 -> v7 (Josh, 9 October 2026: "No, fix this."): v7 added planned admissions and their id
 * sequence and nothing else. A v6 save keeps every record it holds and gains an empty booking list
 * and a sequence of nought, the state of a world with no bookings. Fixture bookings are not added:
 * a restored day holds only what was saved. A "v6" save that already carries either field is not
 * a v6 shape and is refused rather than overwritten.
 */
export function migrateStoredWardFlowState(state: unknown, fromVersion: unknown): unknown {
  // Fix plan item 10: a save from before observation levels reads its yes/no flag as a level.
  if (fromVersion === WARD_FLOW_STORED_STATE_VERSION) return upgradeLegacyObservationRows(state);
  if (fromVersion !== 6 || !object(state)) return null;
  if ("plannedAdmissions" in state || "plannedAdmissionSequence" in state) return null;
  return upgradeLegacyObservationRows({ ...state, plannedAdmissions: [], plannedAdmissionSequence: 0 });
}
