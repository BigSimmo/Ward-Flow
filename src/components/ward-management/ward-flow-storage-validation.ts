import { z } from "zod";
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
import {
  MOVEMENT_STAGES,
  COHORTS,
  RECORDED_SEXES,
  REFERRAL_GENDERS,
  BED_RELEASE_STATES,
  REFERRAL_ADDRESSING_STATES,
  ABSENCE_STEPS,
  REFERRAL_DECLINE_REASONS,
} from "./ward-model";
import { BROADCAST_ANSWER_LABELS } from "./alerts/ward-broadcast-model";
import { validateConfiguration } from "./ward-configuration";
import { isSnoozeReason } from "./ward-inbox-snooze";
import { WARD_SCENARIOS } from "./ward-scenarios";
import { allEmergencyDepartments, siteByCode } from "./ward-sites";
import { communityTeamById } from "./community/community-derivations";
import { syntheticGovernanceAuditEvents } from "./ward-governance-seed";
import { UNDO_STEP_ACTIONS } from "./ward-undo";

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
const fits = (schema: z.ZodType, value: unknown) => schema.safeParse(value).success;

// zod 4 numbers refuse NaN and both infinities, and `z.int()` is a safe integer.
const finite = z.number();
const counter = z.int().nonnegative();
const text = z.string();
const bool = z.boolean();
const record = z.looseObject({});
const records = z.array(record);
const strings = z.array(text);
const nullableFinite = finite.nullable();
const nullableText = text.nullable();
const urgency = z.literal([1, 2, 3]);
/** A bed number: a whole number from 1. `Number.isInteger`, unlike `z.int()`, has no size cap. */
const bed = z.number().min(1).refine(Number.isInteger);
/** A link to another record: absent, null, or an id that `consistent` resolves. */
const link = nullableText.optional();
/** A list that a stored state must hold empty. */
const empty = z.array(z.unknown()).max(0);
/** An object whose every value matches `value`; `consistent` checks the keys where they are ids. */
const entries = <T extends z.ZodType>(value: T) => z.object({}).catchall(value);
const stamped = z.looseObject({ at: finite, by: text });
const distinctIds = (rows: readonly { id: string }[]) => new Set(rows.map((row) => row.id)).size === rows.length;
const id = text.min(1);

// Pass 1: rules for known keys at any depth. A history list holds rows with a finite time and the
// named text fields; a record key holds an object; a unit list holds strings.
const history = (shape: z.ZodRawShape) => z.array(z.looseObject({ at: finite, ...shape }));
const legalFormRule = z.looseObject({
  code: text,
  region: z.enum(["metro", "country"]).optional(),
});
const medicalClearanceRule = z.looseObject({ cleared: bool, at: finite });
const closureRule = z.looseObject({ at: finite, outcome: text, reason: text });
const NESTED_KEY_RULES = new Map<string, z.ZodType>([
  ["statusChanges", history({ from: text, to: text, by: text, reason: text })],
  ["urgencyChanges", history({ by: text, reason: text, from: urgency, to: urgency })],
  ["overrides", history({ by: text, reason: text, unitIds: strings })],
  ["declines", history({ unitId: text, reason: text })],
  ["withdrawnReferrals", history({ unitId: text, reason: text })],
  ["referralAnswerHistory", history({ unitId: text, answer: z.enum(["waitlisted", "declined", "withdrawn"]) })],
  ["unwinds", history({ kind: text, by: text, reason: text })],
  ["stageChanges", history({ to: text, by: text })],
  ["legalFormExpiryHistory", history({ by: text, basis: text })],
  ["legalFormReceiptCorrections", history({ by: text, reason: text })],
  ["genderChanges", history({ by: text, to: text })],
  ["supersededExaminations", history({ outcome: text })],
  ...["destinations", "corrections", "genderPlacements", "urgentFlagHistory", "uploadedForms"].map(
    (key) => [key, records] as const,
  ),
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
      if (!object(item) || referralIntakeError(item as unknown as ReferralIntakeDetails) !== null) return false;
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
const patient = z
  .object({
    id: text.regex(/^PT-/),
    umrn: text,
    givenName: text,
    familyName: text,
    dateOfBirth: text.regex(/^\d{4}-\d{2}-\d{2}$/),
    communityTreatmentOrder: z
      .strictObject({
        form: z.literal("5A"),
        recordedAt: finite,
        recordedBy: text,
        endedAt: finite.optional(),
        earlier: z.array(endedOrder).optional(),
      })
      .optional(),
    // v10 pass 2: `addedAt` is the one other non-text field, a finite instant when present.
    // Optional, so a save made before it existed loads unchanged; no storage version bump.
    addedAt: finite.optional(),
  })
  // Every other patient field stays plain text.
  .catchall(text);

const capacityFigure = z.looseObject({
  value: counter,
  confirmedAt: finite,
  staleAfterMinutes: counter,
  source: z.enum(["feed", "ward"]),
  revision: counter.optional(),
});
const unit = z
  .looseObject({
    id,
    siteCode: text.refine((code) => !!siteByCode(code)),
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
    reservationReleaseCapacityConflicts: z
      .array(
        z.looseObject({
          movementId: text,
          at: finite,
          admissionId: id.optional(),
          allocatableBefore: counter,
          allocatableLockedBefore: counter,
          lockedBedReleased: bool,
        }),
      )
      .optional(),
    arrivalCapacityConflicts: z.array(z.looseObject({ movementId: text, at: finite })).optional(),
  })
  // CONFIRM_CAPACITY records an aggregate ward observation, which may disagree with the older feed
  // empty count and does not rewrite the separately recorded locked count. Each count is bounded
  // above; recovery must not invent a relationship the producer rejects.
  .refine(
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
  );

const emergencyDepartmentId = text.refine((edId) => allEmergencyDepartments().some((ed) => ed.id === edId));
const movement = z
  .looseObject({
    id,
    originEdId: emergencyDepartmentId,
    cohort: z.enum(COHORTS),
    security: z.enum(["Open", "Secure"]),
    sex: z.enum(RECORDED_SEXES),
    legalStatus: text,
    stage: z.enum(MOVEMENT_STAGES),
    owner: text,
    blocker: text,
    openedAt: finite,
    flaggedUrgent: bool,
    specialling: bool,
    highAcuity: bool,
    urgency,
    statusChanges: records,
    urgencyChanges: records,
    overrides: records,
    declines: records,
    withdrawnReferrals: records,
    referralAnswerHistory: records.optional(),
    unwinds: records,
    stageChanges: records,
    referredUnitIds: strings,
    transport: z.looseObject({ id: text, provider: text, escortRequired: bool }).optional(),
    patientId: link,
    referralId: link,
    admissionId: link,
    sourceAdmissionId: link,
    acceptedUnitId: link,
    closure: closureRule.optional(),
    medicalClearance: medicalClearanceRule.optional(),
    medicalDeterioration: z.looseObject({ at: finite, by: z.literal("ed"), resumedAt: finite.optional() }).optional(),
  })
  .refine((movement) => {
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
  });

const admission = z.looseObject({
  id,
  unitId: text,
  state: z.enum(["waitlisted", "pulled", "occupied", "departed"]),
  specialling: bool,
  highAcuity: bool,
  sex: text,
  // R7 / counts follow gender (25 September 2026): optional; absent in older saves, which load as they are.
  gender: z.enum(REFERRAL_GENDERS).optional(),
  dischargeDateMoves: counter,
  // v10 pass 2 (Bed board): optional, a whole bed on the stay's own unit when present.
  bedNumber: bed.optional(),
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
  homeRegion: nullableText,
  dischargeDateSetBy: nullableText,
  dischargeConfirmedBy: nullableText,
  blockReason: nullableText,
  leavingDestination: z.custom(isLeavingDestination).nullable(),
  // A stored barrier is a list value or absent; free text here would be typed text restored from
  // storage (review finding A2-2).
  dischargeBarrier: z.custom(isDischargeBarrier).nullable().optional(),
  careJourney: z.custom(validCareJourney).optional(),
  followUp: z
    .looseObject({ state: z.enum(["arranged", "not_arranged"]), recordedAt: finite, recordedBy: text })
    .nullable(),
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
  z.looseObject({ kind: z.literal("emergency_department"), edId: emergencyDepartmentId, purpose: text }),
]);
const referral = z.looseObject({
  id,
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
    }),
  ),
  patientId: link,
  originUnitId: link,
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
});

// D-38: an absence holds when it was recorded and the time of each fixed missing person step, and
// only those two fixed fields: a restored absence must carry no free text. Each step is done once,
// no earlier than the absence began.
const absence = z
  .strictObject({ since: finite, steps: z.array(z.strictObject({ step: z.enum(ABSENCE_STEPS), at: finite })) })
  .refine(
    (absence) =>
      absence.steps.every((done) => done.at >= absence.since) &&
      new Set(absence.steps.map((done) => done.step)).size === absence.steps.length,
  );
const leaveBed = z.looseObject({
  id,
  unitId: text,
  admissionId: text,
  expectedReturn: finite,
  confirmedAt: finite,
  confirmedBy: text,
  absentWithoutLeave: absence.optional(),
});

const refreshRequest = z.looseObject({ unitId: text, at: finite, byRole: text });

const auditEvent = z
  .looseObject({
    id,
    sequence: counter.min(1),
    generation: counter,
    at: nullableFinite,
    actor: record,
    subject: record,
    details: record,
    action: text,
    category: text,
  })
  .refine(
    (row) =>
      row.action !== "RECORD_ADMISSION_CARE" ||
      (row.details.kind === "care" &&
        (row.details.recorded === undefined || row.details.recorded === null || validCareChange(row.details.recorded))),
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
  durationMinutes: finite.positive(),
  acknowledgedUnits: strings,
  // Global alerts, 10 Oct 2026: every new field is optional, so a version 7 save restores.
  kind: z.enum(["directive", "bed_call", "pull_now"]).optional(),
  replies: z
    .array(
      // The banner looks up each answer and reason label, so an unknown one is refused here.
      z.looseObject({
        unitId: text,
        answer: z.string().refine((answer) => Object.hasOwn(BROADCAST_ANSWER_LABELS, answer)),
        at: finite,
        reason: z.enum(REFERRAL_DECLINE_REASONS).optional(),
        beds: finite.optional(),
        readyAt: finite.optional(),
      }),
    )
    .optional(),
  movementId: text.optional(),
  targetUnitIds: strings.optional(),
  answerBy: finite.optional(),
  // A count past the movement's history would hide a later pull; `consistent` bounds it.
  stageChangesAtDispatch: z.number().nonnegative().refine(Number.isInteger).optional(),
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
    gender: z.enum(REFERRAL_GENDERS).optional(),
    expectedStayDays: z.custom(isPlannedAdmissionStayDays),
    expectedArrivalAt: finite,
    bookedAt: finite,
    bookedBy: text,
    changedAt: nullableFinite,
    changeCount: counter,
    cancelledAt: nullableFinite,
    cancelReason: z.custom(isPlannedAdmissionCancelReason).nullable(),
    convertedAt: nullableFinite,
    patientId: nullableText,
    initials: text.regex(PLANNED_ADMISSION_INITIALS_PATTERN).nullable(),
    admissionId: nullableText,
  })
  .refine(
    (row) =>
      (row.patientId === null) !== (row.initials === null) &&
      (row.state === "arrived" || row.admissionId === null) &&
      (row.state === "cancelled") === (row.cancelReason !== null),
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
    .refine((row) => row.before.id === row.referralId && row.after.id === row.referralId),
  z.looseObject({
    ...undoRow,
    kind: z.literal("bed-placement"),
    admissionId: text,
    unitId: text,
    beforeBed: bed.nullable(),
    afterBed: bed,
  }),
  z
    .looseObject({
      ...undoRow,
      kind: z.literal("step"),
      undoType: text,
      action: text,
      subjectId: text,
      seq: counter.optional(),
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
    .refine((row) => STEP_ACTIONS.get(row.undoType)?.includes(row.action) === true),
]);

const notice = z.looseObject({ id, raisedAt: finite, to: record, about: record, kind: text, sentence: text });

const storedState = z.looseObject({
  auditEvents: z.array(auditEvent).refine(distinctIds),
  auditReviews: z.array(auditReview).refine(distinctIds),
  movements: z.array(movement).refine(distinctIds),
  units: z.array(unit).refine(distinctIds),
  // Refusals are never written (the provider saves `rejections: []`, Josh D-18, 25 Sept 2026,
  // because a refusal can quote a caller-supplied id); refusing a stored one is the second fence.
  rejections: empty,
  bedReleases: z.array(bedRelease).refine(distinctIds),
  leaveBeds: z.array(leaveBed).refine(distinctIds),
  refreshRequests: z.array(refreshRequest),
  referrals: z.array(referral).refine(distinctIds),
  patients: z.array(patient).refine(distinctIds),
  admissions: z.array(admission).refine(distinctIds),
  notices: z.array(notice).refine(distinctIds),
  // Repatriation contains a typed CAD number and can never belong to a persistable session.
  repatriations: empty,
  // Carer/PSP/MHAS notification records hold typed names and reasons (D-18): absent or empty only.
  supportNotifications: empty.optional(),
  handoverSignOffs: z.array(stamped),
  clinicalContacts: z.array(stamped.extend({ teamId: text.refine((teamId) => communityTeamById(teamId) !== null) })),
  broadcastAlerts: z.array(broadcastAlert).refine(distinctIds),
  plannedAdmissions: z.array(plannedAdmission).refine(distinctIds),
  undoRecords: z.array(undoRecord).optional(),
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
  inboxCompletions: entries(z.array(stamped.extend({ kind: z.enum(["completed", "reopened"]) }))),
  // Stream A, 9 Oct 2026: added without a storage version bump, so a save made before them has
  // neither. Absent is valid and restores as empty (`withInboxStreamADefaults`); present must be valid.
  inboxOwnership: entries(z.array(stamped)).optional(),
  inboxSnoozes: entries(
    z.array(
      z.union([
        stamped.extend({ kind: z.literal("returned") }),
        stamped.extend({ kind: z.literal("snoozed"), until: finite, reason: z.custom(isSnoozeReason) }),
      ]),
    ),
  ).optional(),
  morningRollupConfirmations: entries(
    z.looseObject({ confirmedAt: finite, confirmedByRole: text, expectedDischarges: counter }),
  ),
});
type StoredState = z.infer<typeof storedState>;

// Pass 3: links between rows. Ids are already unique within each collection.
function consistent(state: StoredState, value: RecordValue): boolean {
  if (validateConfiguration(value.configuration) === null) return false;
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
    if (!reference(referral.patientId, patientIds) || !reference(referral.originUnitId, unitIds)) return false;
    if (!referral.destinations.every((arm) => reference(arm.acceptedUnitId, unitIds))) return false;
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
  const seededAuditIds = new Set(syntheticGovernanceAuditEvents(value as unknown as WardFlowState).map((e) => e.id));
  for (const row of state.auditReviews)
    if (!auditIds.has(row.eventId) && !seededAuditIds.has(row.eventId) && !row.eventId.startsWith("audit-seed-"))
      return false;

  for (const row of state.undoRecords ?? []) {
    if (row.kind === "bed-placement") {
      if (!admissionIds.has(row.admissionId) || !unitIds.has(row.unitId)) return false;
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
  return parsed.success && consistent(parsed.data, value);
}

/**
 * A validated stored state with the stream A inbox records filled in when the save predates them.
 * Call after `isValidStoredWardFlowState` on every restore path.
 */
export function withInboxStreamADefaults<T extends WardFlowState>(state: T): T {
  const stored = state as T & Partial<Pick<WardFlowState, "inboxOwnership" | "inboxSnoozes">>;
  return { ...state, inboxOwnership: stored.inboxOwnership ?? {}, inboxSnoozes: stored.inboxSnoozes ?? {} };
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
  if (fromVersion === WARD_FLOW_STORED_STATE_VERSION) return state;
  if (fromVersion !== 6 || !object(state)) return null;
  if ("plannedAdmissions" in state || "plannedAdmissionSequence" in state) return null;
  return { ...state, plannedAdmissions: [], plannedAdmissionSequence: 0 };
}
