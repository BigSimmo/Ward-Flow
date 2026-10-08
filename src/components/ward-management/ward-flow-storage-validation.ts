import { validCareJourney, validCareChange } from "./ward-care-journey";
import type { WardFlowState } from "./ward-flow-reducer";
import { isLeavingDestination } from "./ward-admissions";
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

  if (isStoredPrimitive(value)) return true;

  if (typeof value === "number") return finite(value);

  if (Array.isArray(value)) return value.every((item) => item !== null && nested(item, depth + 1));

  if (!object(value)) return false;
  return [
    () => validNestedFields(value, depth),
    () => validNestedMedicalAndLegalRecords(value),
    () => validNestedHistory(value),
    () => validNestedCareRecords(value),
  ].every((check) => check());
}

function isStoredPrimitive(value: unknown): boolean {
  return value === null || text(value) || bool(value);
}

export function isValidStoredWardFlowState(value: unknown): value is WardFlowState {
  if (!object(value) || !nested(value)) return false;
  if (!validStoredHeader(value)) return false;
  const state = value as unknown as WardFlowState;
  if (!validStoredIds(value, state)) return false;
  const references = storedReferences(value);
  return [
    () => validStoredPatients(value),
    () => validStoredUnits(value, state),
    () => validStoredMovements(value, references),
    () => validStoredAdmissions(value, references),
    () => validStoredPatientLinks(state),
    () => validStoredReferrals(value, references),
    () => validStoredBedReferences(value, references),
    () => validStoredBedReleases(value),
    () => validStoredLeaveBeds(value),
    () => validStoredRefreshRequests(value),
    () => validStoredAuditEvents(value, state),
    () => validStoredBroadcastAlerts(value),
    () => validStoredAuditReviews(value, references),
    () => validStoredNotices(value),
    () => validStoredDischargeRevisions(state, references),
    () => validStoredInboxHistory(value),
    () => validStoredRollupConfirmations(state, references),
    () => validPersistableRecords(state),
  ].every((check) => check());
}

type StoredReferences = {
  unitIds: Set<unknown>;
  patientIds: Set<unknown>;
  movementIds: Set<unknown>;
  referralIds: Set<unknown>;
  admissionIds: Set<unknown>;
  auditIds: Set<unknown>;
};
function storedReferences(value: RecordValue): StoredReferences {
  const ids = (name: string) => new Set((value[name] as RecordValue[]).map((item) => item.id));

  const unitIds = ids("units"),
    patientIds = ids("patients"),
    movementIds = ids("movements"),
    referralIds = ids("referrals"),
    admissionIds = ids("admissions"),
    auditIds = ids("auditEvents");
  return { unitIds, patientIds, movementIds, referralIds, admissionIds, auditIds };
}
const reference = (record: RecordValue, key: string, targets: Set<unknown>) =>
  !(key in record) || record[key] === null || targets.has(record[key]);
function validStoredHeader(value: RecordValue): boolean {
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
  ];

  if (!validStoredCounters(value, counts)) return false;

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
  return true;
}

function validStoredIds(value: RecordValue, state: WardFlowState): boolean {
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
  ] as const;

  if (
    !runtimeSequences.every(([collection, pattern, sequence]) =>
      [...(value[collection] as RecordValue[])].every((row) => validIssuedId(row, pattern, sequence)),
    )
  )
    return false;
  return true;
}

function validStoredPatients(value: RecordValue): boolean {
  for (const patient of value.patients as RecordValue[]) {
    if (!Object.values(patient).every(text)) return false;
    if (!fields(patient, ["id", "umrn", "givenName", "familyName", "dateOfBirth"], text)) return false;
    if (!/^PT-/.test(patient.id as string) || !/^\d{4}-\d{2}-\d{2}$/.test(patient.dateOfBirth as string)) return false;
  }
  return true;
}

function validStoredUnits(value: RecordValue, state: WardFlowState): boolean {
  if (![...(value.units as RecordValue[])].every(validStoredUnit)) return false;
  // Aggregate ward observations can disagree with older feed counts. Bound the sex mix,
  // without inventing a relationship the producer does not require.
  return [...state.units].every((unit) => unit.sexMix.Female + unit.sexMix.Male <= unit.beds);
}

function validStoredMovements(value: RecordValue, references: StoredReferences): boolean {
  for (const movement of value.movements as RecordValue[]) {
    if (!validMovementIdentity(movement)) return false;
    if (!validMovementHistory(movement)) return false;
    if (!validMovementTransport(movement)) return false;
    if (!validMovementReferences(movement, references)) return false;
  }
  return true;
}

function validStoredAdmissions(value: RecordValue, references: StoredReferences): boolean {
  for (const admission of value.admissions as RecordValue[]) {
    if (!validAdmissionPlacement(admission, references)) return false;
    if (!validAdmissionDetails(admission)) return false;
    if (!validAdmissionCare(admission)) return false;
    if (!validAdmissionReferences(admission, references)) return false;
  }
  return true;
}

function validStoredPatientLinks(state: WardFlowState): boolean {
  return (
    [...state.movements].every(
      (movement) =>
        samePatient(
          movement,
          state.referrals.find((row) => row.id === movement.referralId),
        ) &&
        samePatient(
          movement,
          state.admissions.find((row) => row.id === movement.admissionId),
        ),
    ) &&
    [...state.admissions].every(
      (admission) =>
        samePatient(
          admission,
          state.movements.find((row) => row.id === admission.movementId),
        ) &&
        samePatient(
          admission,
          state.referrals.find((row) => row.id === admission.referralId),
        ),
    )
  );
}

function validStoredReferrals(value: RecordValue, references: StoredReferences): boolean {
  return [...(value.referrals as RecordValue[])].every((referral) => validReferral(referral, references));
}

function validStoredBedReferences(value: RecordValue, references: StoredReferences): boolean {
  const { unitIds } = references;

  for (const name of ["bedReleases", "leaveBeds", "refreshRequests"]) {
    for (const row of value[name] as RecordValue[]) if (!unitIds.has(row.unitId)) return false;
  }
  return true;
}

function validStoredBedReleases(value: RecordValue): boolean {
  // A release must name one real admission on the same unit. Discharged releases require a
  // departed stay; a live release requires an occupied stay with at most one live release.
  const admissions = new Map((value.admissions as RecordValue[]).map((row) => [row.id, row]));
  const releases = value.bedReleases as RecordValue[];
  const counts = countAdmissionRows(releases.filter((row) => row.state !== "discharged"));
  return [...releases].every((row) => validBedRelease(row, admissions, counts));
}

function validStoredLeaveBeds(value: RecordValue): boolean {
  // Owner ruling 2026-09-25: one leave bed per real occupied stay, on the same unit.
  const admissions = new Map((value.admissions as RecordValue[]).map((row) => [row.id, row]));
  const leaves = value.leaveBeds as RecordValue[];
  const counts = countAdmissionRows(leaves);
  return [...leaves].every((row) => validLeaveBed(row, admissions, counts));
}

function validStoredRefreshRequests(value: RecordValue): boolean {
  for (const row of value.refreshRequests as RecordValue[]) if (!finite(row.at) || !text(row.byRole)) return false;
  return true;
}

function validStoredAuditEvents(value: RecordValue, state: WardFlowState): boolean {
  return [...(value.auditEvents as RecordValue[])].every(
    (row) => validAuditCare(row) && validAuditIdentity(row, state.auditSequence) && validAuditContainers(row),
  );
}

function validStoredBroadcastAlerts(value: RecordValue): boolean {
  const rows = value.broadcastAlerts as RecordValue[];
  return uniqueIds(rows) && rows.every((row) => validBroadcastAudience(row) && validBroadcastDelivery(row));
}

function validStoredAuditReviews(value: RecordValue, references: StoredReferences): boolean {
  const { auditIds } = references;

  for (const row of value.auditReviews as RecordValue[])
    if (!auditIds.has(row.eventId) || !finite(row.at) || !counter(row.generation)) return false;
  return true;
}

function validStoredNotices(value: RecordValue): boolean {
  for (const row of value.notices as RecordValue[])
    if (!finite(row.raisedAt) || !object(row.to) || !object(row.about) || !text(row.kind) || !text(row.sentence))
      return false;
  return true;
}

function validStoredDischargeRevisions(state: WardFlowState, references: StoredReferences): boolean {
  const { admissionIds } = references;

  for (const [id, revision] of Object.entries(state.dischargeRevisions))
    if (!admissionIds.has(id) || !counter(revision)) return false;
  return true;
}

function validStoredInboxHistory(value: RecordValue): boolean {
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
  return true;
}

function validStoredRollupConfirmations(state: WardFlowState, references: StoredReferences): boolean {
  const { unitIds } = references;

  for (const [id, row] of Object.entries(state.morningRollupConfirmations))
    if (
      !unitIds.has(id) ||
      !object(row) ||
      !finite(row.confirmedAt) ||
      !text(row.confirmedByRole) ||
      !counter(row.expectedDischarges)
    )
      return false;
  return true;
}

function validPersistableRecords(state: WardFlowState): boolean {
  // Typed CAD numbers and caller-supplied rejection identifiers must never be persisted.
  if (state.repatriations.length > 0 || state.rejections.length > 0) return false;
  return (
    [...state.handoverSignOffs].every(validHandoverSignOff) && [...state.clinicalContacts].every(validClinicalContact)
  );
}

function validNestedFields(value: RecordValue, depth: number): boolean {
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

  return Object.entries(value).every(
    ([key, item]) =>
      validNestedContainer(key, item, arrayKeys, objectKeys) &&
      validNestedTimestamp(key, item) &&
      nested(item, depth + 1),
  );
}

function validNestedMedicalAndLegalRecords(value: RecordValue): boolean {
  return (
    optional(value, "medicalClearance", validMedicalClearance) &&
    optional(value, "legalForm", validLegalForm) &&
    validLegalRegion(value.legalForm)
  );
}

function validMedicalClearance(value: unknown): boolean {
  return object(value) && bool(value.cleared) && finite(value.at);
}

function validLegalForm(value: unknown): boolean {
  return object(value) && text(value.code);
}

function validLegalRegion(value: unknown): boolean {
  if (!object(value)) return true;
  return value.region === undefined || ["metro", "country"].includes(String(value.region));
}

function validNestedHistory(value: RecordValue): boolean {
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
    if (!validHistoryRows(value[key], required)) return false;
  }

  if ("overrides" in value && !(value.overrides as RecordValue[]).every((row) => strings(row.unitIds))) return false;

  return optional(value, "urgencyChanges", validUrgencyHistory);
}

function validHistoryRows(value: unknown, required: string[]): boolean {
  return records(value) && value.every((row) => finite(row.at) && fields(row, required, text));
}

function validUrgencyHistory(value: unknown): boolean {
  return (value as RecordValue[]).every(
    (row) => [1, 2, 3].includes(row.from as number) && [1, 2, 3].includes(row.to as number),
  );
}

function validNestedCareRecords(value: RecordValue): boolean {
  for (const key of ["transportNeed", "medicalClearance"]) {
    if (!optional(value, key, (record) => validCareFlag(record, key))) return false;
  }

  return optional(value, "closure", validClosure);
}

function validCareFlag(value: unknown, key: string): boolean {
  return object(value) && finite(value.at) && bool(value[key === "transportNeed" ? "needed" : "cleared"]);
}

function validClosure(value: unknown): boolean {
  return object(value) && finite(value.at) && fields(value, ["outcome", "reason"], text);
}

function validUnitIdentity(unit: RecordValue): boolean {
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
  return true;
}

function validUnitCounts(unit: RecordValue): boolean {
  if (
    !fields(
      unit,
      ["beds", "lockedBeds", "allocatableLocked", "held", "blocked", "speciallingCapacity", "highAcuityCapacity"],
      counter,
    )
  )
    return false;

  if (!object(unit.sexMix) || !fields(unit.sexMix, ["Female", "Male"], counter)) return false;
  return true;
}

function validUnitCapacity(unit: RecordValue): boolean {
  return ["empty", "allocatable"].every((field) => validCapacityFigure(unit[field], unit.beds as number));
}

function validUnitCapacityBounds(unit: RecordValue): boolean {
  return (
    !((unit.lockedBeds as number) > (unit.beds as number)) &&
    !((unit.allocatableLocked as number) > (unit.lockedBeds as number)) &&
    !((unit.held as number) + (unit.blocked as number) > (unit.beds as number))
  );
}

function validMovementIdentity(movement: RecordValue): boolean {
  if (
    !fields(
      movement,
      ["id", "originEdId", "cohort", "security", "sex", "legalStatus", "stage", "owner", "blocker"],
      text,
    ) ||
    !finite(movement.openedAt)
  )
    return false;

  if (!validMovementClassification(movement)) return false;
  return true;
}

function validMovementHistory(movement: RecordValue): boolean {
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
  return true;
}

function validMovementTransport(movement: RecordValue): boolean {
  if (!validTransportAssignment(movement)) return false;

  if (!allEmergencyDepartments().some((ed) => ed.id === movement.originEdId)) return false;
  return true;
}

function validMovementReferences(movement: RecordValue, references: StoredReferences): boolean {
  if (!validMovementRecordLinks(movement, references)) return false;

  if (!(movement.referredUnitIds as string[]).every((id) => references.unitIds.has(id))) return false;
  return true;
}

function validAdmissionPlacement(admission: RecordValue, references: StoredReferences): boolean {
  const { unitIds } = references;

  if (admission.leavingDestination !== null && !isLeavingDestination(admission.leavingDestination)) return false;

  if (
    !unitIds.has(admission.unitId) ||
    !["waitlisted", "pulled", "occupied", "departed"].includes(admission.state as string)
  )
    return false;
  return true;
}

function validAdmissionDetails(admission: RecordValue): boolean {
  if (!validAdmissionClinicalFlags(admission)) return false;

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
  return true;
}

function validAdmissionCare(admission: RecordValue): boolean {
  if (admission.careJourney !== undefined && !validCareJourney(admission.careJourney)) return false;
  if (!("followUp" in admission) || !nullable(object)(admission.followUp)) return false;
  return !object(admission.followUp) || validFollowUp(admission.followUp);
}

function validAdmissionReferences(admission: RecordValue, references: StoredReferences): boolean {
  const { patientIds, referralIds, movementIds } = references;
  return (
    reference(admission, "patientId", patientIds) &&
    reference(admission, "referralId", referralIds) &&
    reference(admission, "movementId", movementIds)
  );
}

function samePatient(left: { patientId?: string | null }, right: { patientId?: string | null } | undefined): boolean {
  return !left.patientId || !right?.patientId || left.patientId === right.patientId;
}

function validReferral(referral: RecordValue, references: StoredReferences): boolean {
  if (!validSuburb(referral.suburb)) return false;
  if (!validReferralDetails(referral)) return false;
  if (
    !reference(referral, "patientId", references.patientIds) ||
    !reference(referral, "originUnitId", references.unitIds)
  )
    return false;
  return [...(referral.destinations as RecordValue[])].every((arm) => validReferralArm(arm, references.unitIds));
}
function validSuburb(value: unknown): boolean {
  if (!object(value)) return false;
  return value.kind === "named" ? text(value.name) : value.kind === "unknown" && value.reason === "not_known";
}
function validReferralDetails(referral: RecordValue): boolean {
  return (
    fields(referral, ["id", "ageBand", "homeRegion", "source", "originSiteCode", "history"], text) &&
    finite(referral.raisedAt) &&
    bool(referral.transportNeeded) &&
    [1, 2, 3].includes(referral.urgency as number) &&
    records(referral.destinations)
  );
}
function validReferralArm(arm: RecordValue, unitIds: Set<unknown>): boolean {
  if (!object(arm.destination) || !REFERRAL_ADDRESSING_STATES.includes(arm.state as never)) return false;
  if (!validReferralDestination(arm.destination)) return false;
  return reference(arm, "acceptedUnitId", unitIds);
}
function validReferralDestination(target: RecordValue): boolean {
  switch (target.kind) {
    case "psychiatric_ward":
      return (
        text(target.sex) && fields(target, ["secureBedNeeded", "involuntaryBedNeeded", "highAcuityNursingNeeded"], bool)
      );
    case "community_team":
      return text(target.teamName);
    case "emergency_department":
      return allEmergencyDepartments().some((ed) => ed.id === target.edId) && text(target.purpose);
    default:
      return false;
  }
}

function countAdmissionRows(rows: RecordValue[]): Map<unknown, number> {
  const counts = new Map<unknown, number>();
  for (const row of rows) counts.set(row.admissionId, (counts.get(row.admissionId) ?? 0) + 1);
  return counts;
}
function validBedRelease(
  row: RecordValue,
  admissions: Map<unknown, RecordValue>,
  counts: Map<unknown, number>,
): boolean {
  if (!validBedReleaseDetails(row)) return false;
  if (!text(row.admissionId)) return false;
  const admission = admissions.get(row.admissionId);
  if (!admission) return false;
  if (admission.unitId !== row.unitId) return false;
  if (row.state === "discharged") return admission.state === "departed";
  return admission.state === "occupied" && (counts.get(row.admissionId) ?? 0) <= 1;
}
function validBedReleaseDetails(row: RecordValue): boolean {
  return (
    BED_RELEASE_STATES.includes(row.state as never) &&
    finite(row.expectedAt) &&
    finite(row.confirmedAt) &&
    text(row.confirmedBy) &&
    bool(row.preparing)
  );
}

function validLeaveBed(row: RecordValue, admissions: Map<unknown, RecordValue>, counts: Map<unknown, number>): boolean {
  if (!validLeaveObservation(row)) return false;
  if (!text(row.admissionId)) return false;
  if (!validLeaveAdmission(admissions.get(row.admissionId), row.unitId)) return false;
  return (counts.get(row.admissionId) ?? 0) <= 1;
}
function validLeaveAdmission(admission: RecordValue | undefined, unitId: unknown): boolean {
  return !!admission && admission.unitId === unitId && admission.state === "occupied";
}

function validAuditCare(row: RecordValue): boolean {
  if (row.action !== "RECORD_ADMISSION_CARE") return true;
  if (!object(row.details) || row.details.kind !== "care") return false;
  return row.details.recorded === undefined || row.details.recorded === null || validCareChange(row.details.recorded);
}
function validAuditIdentity(row: RecordValue, sequence: number): boolean {
  // appendAudit issues 1..auditSequence inclusive; rejecting the newest row breaks recovery.
  return (
    counter(row.sequence) &&
    row.sequence >= 1 &&
    row.sequence <= sequence &&
    counter(row.generation) &&
    nullable(finite)(row.at)
  );
}
function validAuditContainers(row: RecordValue): boolean {
  return object(row.actor) && object(row.subject) && object(row.details) && text(row.action) && text(row.category);
}

function validBroadcastAudience(row: RecordValue): boolean {
  return (
    fields(row, ["id", "title", "message", "targetScopeLabel", "dispatchedByRole", "dispatchedByName"], text) &&
    ["critical", "warning", "advisory"].includes(row.severity as string) &&
    [
      "capacity_gridlock",
      "ed_surge",
      "unit_closure",
      "transport_delay",
      "clinical_stream",
      "statutory_advisory",
    ].includes(row.category as string) &&
    ["all", "metro_adult", "ed_liaison", "forensic", "adolescent", "older_adult", "regional_wachs"].includes(
      row.targetScope as string,
    ) &&
    ["active", "stood_down", "expired"].includes(row.status as string)
  );
}
function validBroadcastDelivery(row: RecordValue): boolean {
  return (
    finite(row.dispatchedAt) &&
    finite(row.expiresAt) &&
    finite(row.durationMinutes) &&
    row.durationMinutes > 0 &&
    strings(row.acknowledgedUnits)
  );
}

function validHandoverSignOff(row: unknown): boolean {
  return object(row) && finite(row.at) && text(row.by);
}
function validClinicalContact(row: unknown): boolean {
  return validHandoverSignOff(row) && object(row) && text(row.teamId) && !!communityTeamById(row.teamId);
}

function validCapacityFigure(value: unknown, beds: number): boolean {
  if (!object(value)) return false;
  return validCapacityObservation(value) && optional(value, "revision", counter) && (value.value as number) <= beds;
}
function validCapacityObservation(value: RecordValue): boolean {
  return (
    counter(value.value) &&
    finite(value.confirmedAt) &&
    counter(value.staleAfterMinutes) &&
    ["feed", "ward"].includes(value.source as string)
  );
}

function validFollowUp(value: RecordValue): boolean {
  return (
    ["arranged", "not_arranged"].includes(value.state as string) && finite(value.recordedAt) && text(value.recordedBy)
  );
}

function validMovementClassification(movement: RecordValue): boolean {
  return (
    MOVEMENT_STAGES.includes(movement.stage as never) &&
    COHORTS.includes(movement.cohort as never) &&
    RECORDED_SEXES.includes(movement.sex as never) &&
    ["Open", "Secure"].includes(movement.security as string)
  );
}

function validTransportAssignment(movement: RecordValue): boolean {
  return !(
    movement.transport !== undefined &&
    (!object(movement.transport) ||
      !fields(movement.transport, ["id", "provider"], text) ||
      !bool(movement.transport.escortRequired))
  );
}

function validMovementRecordLinks(movement: RecordValue, references: StoredReferences): boolean {
  const { patientIds, referralIds, admissionIds, unitIds } = references;
  return (
    reference(movement, "patientId", patientIds) &&
    reference(movement, "referralId", referralIds) &&
    reference(movement, "admissionId", admissionIds) &&
    reference(movement, "sourceAdmissionId", admissionIds) &&
    reference(movement, "acceptedUnitId", unitIds)
  );
}

function validAdmissionClinicalFlags(admission: RecordValue): boolean {
  return (
    fields(admission, ["specialling", "highAcuity"], bool) &&
    text(admission.sex) &&
    !(admission.gender !== undefined && !REFERRAL_GENDERS.includes(admission.gender as never)) &&
    counter(admission.dischargeDateMoves)
  );
}

function validStoredCounters(value: RecordValue, counts: string[]): boolean {
  return fields(value, counts, counter) && finite(value.auditCaptureStartedAt) && finite(value.clockOffsetMinutes);
}

function validLeaveObservation(row: RecordValue): boolean {
  return finite(row.expectedReturn) && finite(row.confirmedAt) && text(row.confirmedBy);
}

function validNestedContainer(key: string, item: unknown, arrayKeys: string[], objectKeys: string[]): boolean {
  if (["__proto__", "constructor", "prototype"].includes(key)) return false;
  if (arrayKeys.includes(key) && !records(item)) return false;
  if (objectKeys.includes(key) && !object(item)) return false;
  return (
    !["referredUnitIds", "waitlistedUnitIds", "triedUnitIds", "closedBayIds", "intakeConstraints"].includes(key) ||
    strings(item)
  );
}
function validNestedTimestamp(key: string, item: unknown): boolean {
  return !isTimestampField(key) || nullable(finite)(item);
}
function isTimestampField(key: string): boolean {
  return key === "at" || key.endsWith("At") || key.endsWith("Minutes");
}

function validIssuedId(row: RecordValue, pattern: RegExp, sequence: number): boolean {
  const match = pattern.exec(row.id as string);
  return !match || Number(match[1]) <= sequence;
}

function validStoredUnit(unit: RecordValue): boolean {
  return validUnitIdentity(unit) && validUnitCounts(unit) && validUnitCapacity(unit) && validUnitCapacityBounds(unit);
}
