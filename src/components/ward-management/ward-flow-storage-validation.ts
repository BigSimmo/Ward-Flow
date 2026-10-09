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
} from "./ward-model";
import { validateConfiguration } from "./ward-configuration";
import { WARD_SCENARIOS } from "./ward-scenarios";
import { allEmergencyDepartments, siteByCode } from "./ward-sites";
import { communityTeamById } from "./community/community-derivations";

type RecordValue = Record<string, unknown>;
const object = (v: unknown): v is RecordValue => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string";
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const counter = (v: unknown): v is number => finite(v) && Number.isSafeInteger(v) && v >= 0;
const bool = (v: unknown) => typeof v === "boolean";
const records = (v: unknown): v is RecordValue[] => Array.isArray(v) && v.every(object);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(text);
const fields = (v: RecordValue, keys: string[], check: (x: unknown) => boolean) => keys.every((key) => check(v[key]));
const nullable = (check: (x: unknown) => boolean) => (v: unknown) => v === null || check(v);
const optional = (v: RecordValue, key: string, check: (x: unknown) => boolean) => !(key in v) || check(v[key]);
const uniqueIds = (items: RecordValue[]) =>
  items.every((v) => text(v.id) && v.id.length > 0) && new Set(items.map((v) => v.id)).size === items.length;

/** Check nested containers before any screen or allocator can touch them. This is a recovery
 * fence, not a producer: a rejected payload is never repaired or mixed with fixture records. */
function nested(value: unknown, depth = 0): boolean {
  if (depth > 40) return false;
  if (value === null || text(value) || bool(value)) return true;
  if (typeof value === "number") return finite(value);
  if (Array.isArray(value)) return value.every((item) => item !== null && nested(item, depth + 1));
  if (!object(value)) return false;
  const arrayKeys = [
    "statusChanges",
    "urgencyChanges",
    "overrides",
    "declines",
    "withdrawnReferrals",
    "unwinds",
    "stageChanges",
    "destinations",
    "corrections",
    "legalFormExpiryHistory",
    "legalFormReceiptCorrections",
    "genderChanges",
    "genderPlacements",
    "urgentFlagHistory",
    "supersededExaminations",
    "uploadedForms",
  ];
  const objectKeys = [
    "legalForm",
    "legalClock",
    "medicalClearance",
    "transport",
    "closure",
    "examination",
    "urgentFlag",
    "expectFlag",
    "referralAbsence",
    "transportNeed",
    "arrivalDetails",
    "legalMismatch",
    "escalation",
    "destination",
    "about",
    "actor",
    "subject",
    "details",
  ];
  for (const [key, item] of Object.entries(value)) {
    if (["__proto__", "constructor", "prototype"].includes(key)) return false;
    // A drawer referral's intake has its own shape (string times, a clearance with no `at`) and its
    // own validator, the one RECEIVE_REFERRAL applies. The generic walk below misread it and
    // refused every world holding one, so no such scenario could be saved (review finding A2-1).
    if (key === "intake") {
      if (!object(item) || referralIntakeError(item as unknown as ReferralIntakeDetails) !== null) return false;
      continue;
    }
    if (arrayKeys.includes(key) && !records(item)) return false;
    if (objectKeys.includes(key) && !object(item)) return false;
    if (
      ["referredUnitIds", "waitlistedUnitIds", "triedUnitIds", "closedBayIds", "intakeConstraints"].includes(key) &&
      !strings(item)
    )
      return false;
    if ((key === "at" || key.endsWith("At") || key.endsWith("Minutes")) && !nullable(finite)(item)) return false;
    if (!nested(item, depth + 1)) return false;
  }
  if (
    "medicalClearance" in value &&
    (!object(value.medicalClearance) || !bool(value.medicalClearance.cleared) || !finite(value.medicalClearance.at))
  )
    return false;
  if ("atsCategory" in value && ![1, 2, 3, 4, 5].includes(value.atsCategory as number)) return false;
  if ("legalForm" in value && (!object(value.legalForm) || !text(value.legalForm.code))) return false;
  if (
    object(value.legalForm) &&
    value.legalForm.region !== undefined &&
    !["metro", "country"].includes(String(value.legalForm.region))
  )
    return false;
  const historyRequirements: Record<string, string[]> = {
    statusChanges: ["from", "to", "by", "reason"],
    urgencyChanges: ["by", "reason"],
    overrides: ["by", "reason"],
    declines: ["unitId", "reason"],
    withdrawnReferrals: ["unitId", "reason"],
    unwinds: ["kind", "by", "reason"],
    stageChanges: ["to", "by"],
    legalFormExpiryHistory: ["by", "basis"],
    legalFormReceiptCorrections: ["by", "reason"],
    genderChanges: ["by", "to"],
    supersededExaminations: ["outcome"],
  };
  for (const [key, required] of Object.entries(historyRequirements)) {
    if (!(key in value)) continue;
    if (!records(value[key]) || !value[key].every((row) => finite(row.at) && fields(row, required, text))) return false;
  }
  if ("overrides" in value && !(value.overrides as RecordValue[]).every((row) => strings(row.unitIds))) return false;
  if (
    "urgencyChanges" in value &&
    !(value.urgencyChanges as RecordValue[]).every(
      (row) => [1, 2, 3].includes(row.from as number) && [1, 2, 3].includes(row.to as number),
    )
  )
    return false;
  for (const key of ["transportNeed", "medicalClearance"]) {
    if (
      key in value &&
      (!object(value[key]) ||
        !finite(value[key].at) ||
        !bool(value[key][key === "transportNeed" ? "needed" : "cleared"]))
    )
      return false;
  }
  if (
    "closure" in value &&
    (!object(value.closure) || !finite(value.closure.at) || !fields(value.closure, ["outcome", "reason"], text))
  )
    return false;
  return true;
}

export function isValidStoredWardFlowState(value: unknown): value is WardFlowState {
  if (!object(value) || !nested(value)) return false;
  const arrays = [
    "auditEvents",
    "auditReviews",
    "movements",
    "units",
    "rejections",
    "bedReleases",
    "leaveBeds",
    "refreshRequests",
    "referrals",
    "patients",
    "admissions",
    "notices",
    "repatriations",
    "handoverSignOffs",
    "clinicalContacts",
    "broadcastAlerts",
    "plannedAdmissions",
  ];
  if (!fields(value, arrays, records)) return false;
  const counts = [
    "worldGeneration",
    "auditSequence",
    "auditReviewSequence",
    "referralSequence",
    "leaveBedSequence",
    "frontDoorReferralSequence",
    "patientSequence",
    "admissionSequence",
    "broadcastSequence",
    "plannedAdmissionSequence",
  ];
  if (!fields(value, counts, counter) || !finite(value.auditCaptureStartedAt) || !finite(value.clockOffsetMinutes))
    return false;
  if (!WARD_SCENARIOS.includes(value.scenario as never) || validateConfiguration(value.configuration) === null)
    return false;
  if (
    !fields(
      value,
      ["dischargeRevisions", "inboxAcknowledgements", "inboxCompletions", "morningRollupConfirmations"],
      object,
    )
  )
    return false;
  const state = value as unknown as WardFlowState;
  for (const name of [
    "auditEvents",
    "auditReviews",
    "movements",
    "units",
    "referrals",
    "patients",
    "admissions",
    "notices",
    "bedReleases",
    "leaveBeds",
    "rejections",
    "plannedAdmissions",
  ]) {
    if (!uniqueIds(value[name] as RecordValue[])) return false;
  }
  const runtimeSequences = [
    ["patients", /^PT-A(\d+)$/, state.patientSequence],
    ["admissions", /^AD-ARR-(\d+)$/, state.admissionSequence],
    ["movements", /^WF-9(\d+)$/, state.referralSequence],
    ["referrals", /^RF-9(\d+)$/, state.frontDoorReferralSequence],
    ["leaveBeds", /^WL-9(\d+)$/, state.leaveBedSequence],
    ["broadcastAlerts", /^BCAST-(\d+)$/, state.broadcastSequence],
    ["plannedAdmissions", /^PA-(\d+)$/, state.plannedAdmissionSequence],
  ] as const;
  for (const [collection, pattern, sequence] of runtimeSequences) {
    for (const row of value[collection] as RecordValue[]) {
      const match = pattern.exec(row.id as string);
      if (match && Number(match[1]) > sequence) return false;
    }
  }
  const ids = (name: string) => new Set((value[name] as RecordValue[]).map((item) => item.id));
  const unitIds = ids("units"),
    patientIds = ids("patients"),
    movementIds = ids("movements"),
    referralIds = ids("referrals"),
    admissionIds = ids("admissions"),
    auditIds = ids("auditEvents");
  const reference = (record: RecordValue, key: string, targets: Set<unknown>) =>
    !(key in record) || record[key] === null || targets.has(record[key]);
  for (const patient of value.patients as RecordValue[]) {
    if (!Object.values(patient).every(text)) return false;
    if (!fields(patient, ["id", "umrn", "givenName", "familyName", "dateOfBirth"], text)) return false;
    if (!/^PT-/.test(patient.id as string) || !/^\d{4}-\d{2}-\d{2}$/.test(patient.dateOfBirth as string)) return false;
  }
  for (const unit of value.units as RecordValue[]) {
    if (
      !fields(unit, ["id", "siteCode", "name", "cohort", "sexDesignation"], text) ||
      !siteByCode(unit.siteCode as string)
    )
      return false;
    if (
      !COHORTS.includes(unit.cohort as never) ||
      !["Undesignated", "Female only", "Male only"].includes(unit.sexDesignation as string)
    )
      return false;
    if (!fields(unit, ["authorised", "forensic"], bool)) return false;
    if (
      !fields(
        unit,
        ["beds", "lockedBeds", "allocatableLocked", "held", "blocked", "speciallingCapacity", "highAcuityCapacity"],
        counter,
      )
    )
      return false;
    if (!object(unit.sexMix) || !fields(unit.sexMix, ["Female", "Male"], counter)) return false;
    for (const field of ["empty", "allocatable"]) {
      const figure = unit[field];
      if (
        !object(figure) ||
        !counter(figure.value) ||
        !finite(figure.confirmedAt) ||
        !counter(figure.staleAfterMinutes) ||
        !["feed", "ward"].includes(figure.source as string) ||
        !optional(figure, "revision", counter) ||
        figure.value > (unit.beds as number)
      )
        return false;
    }
    if (
      (unit.lockedBeds as number) > (unit.beds as number) ||
      (unit.allocatableLocked as number) > (unit.lockedBeds as number) ||
      (unit.held as number) + (unit.blocked as number) > (unit.beds as number)
    )
      return false;
  }
  for (const unit of state.units) {
    // CONFIRM_CAPACITY records an aggregate ward observation, which may disagree with the
    // older feed empty count and does not rewrite the separately recorded locked count.
    // Each count is bounded above; recovery must not invent a relationship the producer rejects.
    // Release conflicts are bounded historical observations, not evidence of an arrival or a
    // reason to relax any count invariant. A movement can later be re-pulled (including reusing
    // its admission id), so current placement/admission presence cannot invalidate that history.
    const releaseConflicts = unit.reservationReleaseCapacityConflicts;
    if (releaseConflicts !== undefined && !Array.isArray(releaseConflicts)) return false;
    const releasedMovementIds = new Set<string>();
    for (const conflict of releaseConflicts ?? []) {
      if (
        !object(conflict) ||
        !text(conflict.movementId) ||
        !state.movements.some((movement) => movement.id === conflict.movementId) ||
        releasedMovementIds.has(conflict.movementId) ||
        !finite(conflict.at) ||
        !optional(conflict, "admissionId", (id) => text(id) && id.length > 0) ||
        !counter(conflict.allocatableBefore) ||
        conflict.allocatableBefore > unit.beds ||
        !counter(conflict.allocatableLockedBefore) ||
        conflict.allocatableLockedBefore > unit.lockedBeds ||
        !bool(conflict.lockedBedReleased) ||
        !(
          conflict.allocatableBefore === unit.beds ||
          (conflict.lockedBedReleased && conflict.allocatableLockedBefore === unit.lockedBeds)
        )
      )
        return false;
      releasedMovementIds.add(conflict.movementId);
    }
    const conflicts = unit.arrivalCapacityConflicts;
    if (conflicts !== undefined && !Array.isArray(conflicts)) return false;
    const seen = new Set<string>();
    for (const conflict of conflicts ?? []) {
      if (!object(conflict) || !text(conflict.movementId) || !finite(conflict.at) || seen.has(conflict.movementId))
        return false;
      seen.add(conflict.movementId);
      const movement = state.movements.find((entry) => entry.id === conflict.movementId);
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
        const admission = state.admissions.find((entry) => entry.id === conflict.admissionId);
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
  for (const movement of value.movements as RecordValue[]) {
    if (
      !fields(
        movement,
        ["id", "originEdId", "cohort", "security", "sex", "legalStatus", "stage", "owner", "blocker"],
        text,
      ) ||
      !finite(movement.openedAt)
    )
      return false;
    if (
      !MOVEMENT_STAGES.includes(movement.stage as never) ||
      !COHORTS.includes(movement.cohort as never) ||
      !RECORDED_SEXES.includes(movement.sex as never) ||
      !["Open", "Secure"].includes(movement.security as string)
    )
      return false;
    if (
      !fields(movement, ["flaggedUrgent", "specialling", "highAcuity"], bool) ||
      ![1, 2, 3].includes(movement.urgency as number)
    )
      return false;
    if (
      !fields(
        movement,
        ["statusChanges", "urgencyChanges", "overrides", "declines", "withdrawnReferrals", "unwinds", "stageChanges"],
        records,
      ) ||
      !strings(movement.referredUnitIds)
    )
      return false;
    if (
      movement.transport !== undefined &&
      (!object(movement.transport) ||
        !fields(movement.transport, ["id", "provider"], text) ||
        !bool(movement.transport.escortRequired))
    )
      return false;
    if (!allEmergencyDepartments().some((ed) => ed.id === movement.originEdId)) return false;
    if (
      !reference(movement, "patientId", patientIds) ||
      !reference(movement, "referralId", referralIds) ||
      !reference(movement, "admissionId", admissionIds) ||
      !reference(movement, "sourceAdmissionId", admissionIds) ||
      !reference(movement, "acceptedUnitId", unitIds)
    )
      return false;
    if (!movement.referredUnitIds.every((id) => unitIds.has(id))) return false;
  }
  for (const admission of value.admissions as RecordValue[]) {
    if (admission.leavingDestination !== null && !isLeavingDestination(admission.leavingDestination)) return false;
    // A stored barrier is a list value or absent; free text here would be typed text restored from
    // storage (review finding A2-2).
    if (
      admission.dischargeBarrier !== undefined &&
      admission.dischargeBarrier !== null &&
      !isDischargeBarrier(admission.dischargeBarrier)
    )
      return false;
    if (
      !unitIds.has(admission.unitId) ||
      !["waitlisted", "pulled", "occupied", "departed"].includes(admission.state as string)
    )
      return false;
    if (
      !fields(admission, ["specialling", "highAcuity"], bool) ||
      !text(admission.sex) ||
      // R7 / counts follow gender (25 September 2026): optional; absent in older saves, which load as they are.
      (admission.gender !== undefined && !REFERRAL_GENDERS.includes(admission.gender as never)) ||
      !counter(admission.dischargeDateMoves)
    )
      return false;
    if (
      !fields(
        admission,
        [
          "pulledAt",
          "arrivedAt",
          "awayAtEmergencyDepartmentSince",
          "expectedDischargeAt",
          "dischargeDateSetAt",
          "dischargeConfirmedAt",
          "leftAt",
        ],
        nullable(finite),
      )
    )
      return false;
    if (
      !fields(
        admission,
        [
          "patientId",
          "referralId",
          "movementId",
          "homeRegion",
          "dischargeDateSetBy",
          "dischargeConfirmedBy",
          "blockReason",
          "leavingDestination",
        ],
        nullable(text),
      )
    )
      return false;
    if (admission.careJourney !== undefined && !validCareJourney(admission.careJourney)) return false;
    if (!("followUp" in admission) || !nullable(object)(admission.followUp)) return false;
    if (
      object(admission.followUp) &&
      (!["arranged", "not_arranged"].includes(admission.followUp.state as string) ||
        !finite(admission.followUp.recordedAt) ||
        !text(admission.followUp.recordedBy))
    )
      return false;
    if (
      !reference(admission, "patientId", patientIds) ||
      !reference(admission, "referralId", referralIds) ||
      !reference(admission, "movementId", movementIds)
    )
      return false;
  }
  const samePatient = (left: { patientId?: string | null }, right: { patientId?: string | null } | undefined) =>
    !left.patientId || !right?.patientId || left.patientId === right.patientId;
  for (const movement of state.movements) {
    if (movement.medicalDeterioration !== undefined) {
      const pause = movement.medicalDeterioration;
      if (
        !object(pause) ||
        !finite(pause.at) ||
        pause.by !== "ed" ||
        (pause.resumedAt !== undefined && (!finite(pause.resumedAt) || pause.resumedAt <= pause.at))
      )
        return false;
      if (
        pause.resumedAt === undefined &&
        (movement.acceptedUnitId !== undefined ||
          movement.admissionId !== undefined ||
          movement.stage !== "placement_requested" ||
          movement.medicalClearance?.cleared !== false ||
          (movement.transport !== undefined && movement.transport.cancelledAt === undefined))
      )
        return false;
    }
    if (movement.admissionId !== undefined) {
      const admission = state.admissions.find((entry) => entry.id === movement.admissionId);
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
    if (
      !samePatient(
        movement,
        state.referrals.find((referral) => referral.id === movement.referralId),
      ) ||
      !samePatient(
        movement,
        state.admissions.find((admission) => admission.id === movement.admissionId),
      )
    )
      return false;
  }
  for (const admission of state.admissions) {
    // Seed admissions deliberately have movementId=null. Runtime destination stays must have
    // the reciprocal link; sending/source stays keep their own original movement link.
    if (admission.movementId !== null && (admission.state === "pulled" || admission.state === "occupied")) {
      const movement = state.movements.find((entry) => entry.id === admission.movementId);
      if (!movement || movement.admissionId !== admission.id) return false;
    }
    if (
      !samePatient(
        admission,
        state.movements.find((movement) => movement.id === admission.movementId),
      ) ||
      !samePatient(
        admission,
        state.referrals.find((referral) => referral.id === admission.referralId),
      )
    )
      return false;
  }
  for (const referral of value.referrals as RecordValue[]) {
    if (
      !object(referral.suburb) ||
      (referral.suburb.kind === "named"
        ? !text(referral.suburb.name)
        : referral.suburb.kind !== "unknown" || referral.suburb.reason !== "not_known")
    )
      return false;
    if (
      !fields(referral, ["id", "ageBand", "homeRegion", "source", "originSiteCode", "history"], text) ||
      !finite(referral.raisedAt) ||
      !bool(referral.transportNeeded) ||
      ![1, 2, 3].includes(referral.urgency as number) ||
      !records(referral.destinations)
    )
      return false;
    if (!reference(referral, "patientId", patientIds) || !reference(referral, "originUnitId", unitIds)) return false;
    for (const arm of referral.destinations) {
      if (!object(arm.destination) || !REFERRAL_ADDRESSING_STATES.includes(arm.state as never)) return false;
      const target = arm.destination;
      if (
        target.kind === "psychiatric_ward"
          ? !text(target.sex) ||
            !fields(target, ["secureBedNeeded", "involuntaryBedNeeded", "highAcuityNursingNeeded"], bool)
          : target.kind === "community_team"
            ? !text(target.teamName)
            : target.kind === "emergency_department"
              ? !allEmergencyDepartments().some((ed) => ed.id === target.edId) || !text(target.purpose)
              : true
      )
        return false;
      if (!reference(arm, "acceptedUnitId", unitIds)) return false;
    }
  }
  for (const name of ["bedReleases", "leaveBeds", "refreshRequests"]) {
    for (const row of value[name] as RecordValue[]) if (!unitIds.has(row.unitId)) return false;
  }
  // Owner decision 2026-09-25: a bed release names the admission it belongs to. `admissionById`
  // resolves that link to exactly one real admission (ids are already checked unique above); the
  // reducer's own refusals (FLAG_BED_RELEASE, RELEASE_BED) are mirrored here so a hand-edited or
  // stale save cannot carry a release the current reducer could never have produced.
  const admissionById = new Map((value.admissions as RecordValue[]).map((a) => [a.id, a]));
  const liveReleaseCountByAdmission = new Map<unknown, number>();
  for (const row of value.bedReleases as RecordValue[]) {
    if (row.state !== "discharged") {
      liveReleaseCountByAdmission.set(row.admissionId, (liveReleaseCountByAdmission.get(row.admissionId) ?? 0) + 1);
    }
  }
  for (const row of value.bedReleases as RecordValue[]) {
    if (
      !BED_RELEASE_STATES.includes(row.state as never) ||
      !finite(row.expectedAt) ||
      !finite(row.confirmedAt) ||
      !text(row.confirmedBy) ||
      !bool(row.preparing)
    )
      return false;
    if (!text(row.admissionId)) return false;
    const linkedAdmission = admissionById.get(row.admissionId);
    if (!linkedAdmission) return false;
    if (linkedAdmission.unitId !== row.unitId) return false;
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
  const leaveCountByAdmission = new Map<unknown, number>();
  for (const row of value.leaveBeds as RecordValue[]) {
    leaveCountByAdmission.set(row.admissionId, (leaveCountByAdmission.get(row.admissionId) ?? 0) + 1);
  }
  for (const row of value.leaveBeds as RecordValue[]) {
    if (!finite(row.expectedReturn) || !finite(row.confirmedAt) || !text(row.confirmedBy)) return false;
    if (!text(row.admissionId)) return false;
    const onLeave = admissionById.get(row.admissionId);
    if (!onLeave || onLeave.unitId !== row.unitId || onLeave.state !== "occupied") return false;
    if ((leaveCountByAdmission.get(row.admissionId) ?? 0) > 1) return false;
  }
  for (const row of value.refreshRequests as RecordValue[]) if (!finite(row.at) || !text(row.byRole)) return false;
  for (const row of value.auditEvents as RecordValue[]) {
    if (row.action === "RECORD_ADMISSION_CARE") {
      if (
        !object(row.details) ||
        row.details.kind !== "care" ||
        (row.details.recorded !== undefined && row.details.recorded !== null && !validCareChange(row.details.recorded))
      )
        return false;
    }

    // `appendAudit` (ward-audit.ts) numbers rows from 1 and stores the newest number as
    // `auditSequence`, so issued numbers run 1..auditSequence INCLUSIVE. This used to refuse
    // `>= auditSequence`, i.e. always the newest row, so no audited day could be restored on
    // reload (live walkthrough, 25 Sept 2026; tests/ward-flow-recovery-audit-sequence.dom.test.tsx).
    if (
      !counter(row.sequence) ||
      row.sequence < 1 ||
      row.sequence > state.auditSequence ||
      !counter(row.generation) ||
      !nullable(finite)(row.at) ||
      !object(row.actor) ||
      !object(row.subject) ||
      !object(row.details) ||
      !text(row.action) ||
      !text(row.category)
    )
      return false;
  }
  if (!uniqueIds(value.broadcastAlerts as RecordValue[])) return false;
  for (const row of value.broadcastAlerts as RecordValue[]) {
    if (
      !fields(row, ["id", "title", "message", "targetScopeLabel", "dispatchedByRole", "dispatchedByName"], text) ||
      !["critical", "warning", "advisory"].includes(row.severity as string) ||
      ![
        "capacity_gridlock",
        "ed_surge",
        "unit_closure",
        "transport_delay",
        "clinical_stream",
        "statutory_advisory",
      ].includes(row.category as string) ||
      !["all", "metro_adult", "ed_liaison", "forensic", "adolescent", "older_adult", "regional_wachs"].includes(
        row.targetScope as string,
      ) ||
      !["active", "stood_down", "expired"].includes(row.status as string) ||
      !finite(row.dispatchedAt) ||
      !finite(row.expiresAt) ||
      !finite(row.durationMinutes) ||
      row.durationMinutes <= 0 ||
      !strings(row.acknowledgedUnits)
    )
      return false;
  }
  // Stream D: a planned admission names a real ward, chooses every category from its fixed list,
  // and names either an existing patient or one to three initials. An arrived booking names the
  // admission it became: that admission is on the booking's ward and carries the booking's own
  // patient link (none for initials only). A later departure leaves both facts true.
  for (const row of value.plannedAdmissions as RecordValue[]) {
    const hasPatient = text(row.patientId);
    const hasInitials = text(row.initials);
    const becameAdmission =
      row.state === "arrived" && text(row.admissionId)
        ? (value.admissions as RecordValue[]).find((admission) => admission.id === row.admissionId)
        : undefined;
    if (
      !unitIds.has(row.unitId) ||
      !PLANNED_ADMISSION_STATES.includes(row.state as never) ||
      !isPlannedAdmissionReason(row.reason) ||
      !isPlannedAdmissionLegalStatus(row.legalStatus) ||
      !COHORTS.includes(row.ageBand as never) ||
      !RECORDED_SEXES.includes(row.sex as never) ||
      !isPlannedAdmissionStayDays(row.expectedStayDays) ||
      !finite(row.expectedArrivalAt) ||
      !finite(row.bookedAt) ||
      !text(row.bookedBy) ||
      !nullable(finite)(row.changedAt) ||
      !counter(row.changeCount) ||
      !nullable(finite)(row.cancelledAt) ||
      !nullable(isPlannedAdmissionCancelReason)(row.cancelReason) ||
      !nullable(finite)(row.convertedAt) ||
      hasPatient === hasInitials ||
      (hasPatient && !patientIds.has(row.patientId)) ||
      (!hasPatient && row.patientId !== null) ||
      (hasInitials && !PLANNED_ADMISSION_INITIALS_PATTERN.test(row.initials as string)) ||
      (!hasInitials && row.initials !== null) ||
      (row.state === "arrived") !== (text(row.admissionId) && admissionIds.has(row.admissionId)) ||
      (row.state === "arrived" &&
        (becameAdmission === undefined ||
          becameAdmission.unitId !== row.unitId ||
          becameAdmission.patientId !== (hasPatient ? row.patientId : null))) ||
      (row.state !== "arrived" && row.admissionId !== null) ||
      (row.state === "cancelled") !== (row.cancelReason !== null)
    )
      return false;
  }
  for (const row of value.auditReviews as RecordValue[])
    if (!auditIds.has(row.eventId) || !finite(row.at) || !counter(row.generation)) return false;
  for (const row of value.notices as RecordValue[])
    if (!finite(row.raisedAt) || !object(row.to) || !object(row.about) || !text(row.kind) || !text(row.sentence))
      return false;
  for (const [id, revision] of Object.entries(state.dischargeRevisions))
    if (!admissionIds.has(id) || !counter(revision)) return false;
  for (const name of ["inboxAcknowledgements", "inboxCompletions"]) {
    for (const rows of Object.values(value[name] as RecordValue))
      if (
        !records(rows) ||
        !rows.every(
          (row) =>
            finite(row.at) &&
            text(row.by) &&
            (name !== "inboxCompletions" || ["completed", "reopened"].includes(row.kind as string)),
        )
      )
        return false;
  }
  for (const [id, row] of Object.entries(state.morningRollupConfirmations))
    if (
      !unitIds.has(id) ||
      !object(row) ||
      !finite(row.confirmedAt) ||
      !text(row.confirmedByRole) ||
      !counter(row.expectedDischarges)
    )
      return false;
  // Repatriation contains a typed CAD number and can never belong to a persistable session.
  // Refusals are never written (the provider saves `rejections: []`, Josh D-18, 25 Sept 2026,
  // because a refusal can quote a caller-supplied id); refusing a stored one is the second fence.
  if (state.repatriations.length > 0 || state.rejections.length > 0) return false;
  for (const row of state.handoverSignOffs) if (!object(row) || !finite(row.at) || !text(row.by)) return false;
  for (const row of state.clinicalContacts)
    if (!object(row) || !finite(row.at) || !text(row.by) || !text(row.teamId) || !communityTeamById(row.teamId))
      return false;
  return true;
}
