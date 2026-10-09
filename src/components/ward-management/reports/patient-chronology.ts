import type { Admission } from "@/components/ward-management/ward-admissions";
import type { AuditEvent } from "@/components/ward-management/ward-audit";
import {
  changeReasonLabels,
  legalFormReceiptCorrectionReasonLabels,
  withdrawalReasonLabels,
} from "@/components/ward-management/ward-change-reasons";
import { formatSheetMoment, type Instant } from "@/components/ward-management/ward-clock";
import type { EventLogEntry } from "@/components/ward-management/ward-event-log";
import { WARD_FLOW_ROLE_LABELS, type WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import { EVENT_HISTORY_TABLE } from "@/components/ward-management/ward-history";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { stepBackReasonLabels, type Movement, type Referral, type Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { COMMUNITY_DECLINE_REASON_LABELS, DECLINE_REASON_LABELS } from "@/components/ward-management/ward-referrals";
import { createPatientResolver } from "@/components/ward-management/ward-patient-resolver";
import { edById } from "@/components/ward-management/ward-sites";
import { stageCopy } from "@/components/ward-management/ward-stage-copy";
import { declineReasonLabels } from "@/components/ward-management/movements/movement-workspace-derivations";
import { csvCell } from "@/components/ward-management/statistics/statistics-csv";

/**
 * PIR CHRONOLOGY (D-37, WF-57): every recorded fact about one synthetic person, in time order, for a
 * post-incident review. Read-only. It joins the person to their own referrals, movements and
 * admissions, then reads three sources that already exist:
 *
 *   - "Record": the history arrays the reducer keeps on each record (stage, legal status, urgency,
 *     declines, overrides, withdrawals, unwinds, typed legal-form times, ward stay facts). These
 *     include the seeded history, so the chronology is not empty before anyone acts.
 *   - "Audit": the coordinator-only session audit trail, which adds refusals and before/after state.
 *     `null` when the reader may not see it; the screen says so.
 *   - "Session log": the in-memory event log, for an act this session that neither source above
 *     already shows at the same moment (a refused attempt, a transport step).
 *
 * Times are only ever ones the prototype recorded or a person typed. Nothing is computed, and a
 * fact with no time says "Not recorded".
 */

export type ChronologySource = "Record" | "Audit" | "Session log";

export type ChronologyRow = {
  key: string;
  /** When it happened, if that differs from when it was written down or is a typed time. */
  occurredAt: Instant | null;
  /** When the prototype wrote it down. */
  recordedAt: Instant | null;
  who: string;
  action: string;
  /** The kind of record it belongs to: Movement, Referral or Admission. Never an id on screen. */
  record: string;
  before: string;
  after: string;
  /** A chosen override or change reason. Empty when none applies. */
  reason: string;
  source: ChronologySource;
};

export type ChronologyInput = {
  personId: string;
  patients: readonly Patient[];
  movements: readonly Movement[];
  referrals: readonly Referral[];
  admissions: readonly Admission[];
  units: readonly Unit[];
  /** The coordinator's audit read, or `null` when it was denied. */
  auditEvents: readonly AuditEvent[] | null;
  eventLog: readonly EventLogEntry[];
  /** Day 0 of the session, so a typed time can be written as a date. */
  dayZero: Date;
};

export type PatientChronology = {
  patient: Patient | undefined;
  recordIds: { movements: string[]; referrals: string[]; admissions: string[] };
  rows: ChronologyRow[];
  auditIncluded: boolean;
};

const NOT_RECORDED = "Not recorded";

function whoLabel(by: string | null | undefined): string {
  if (!by) return NOT_RECORDED;
  return WARD_FLOW_ROLE_LABELS[by as WardFlowRole] ?? by;
}

/** Every reason code's words, as one `Map`, so a recorded string is looked up, never used as a key. */
const REASON_LABELS: ReadonlyMap<string, string> = new Map(
  [
    COMMUNITY_DECLINE_REASON_LABELS,
    DECLINE_REASON_LABELS,
    withdrawalReasonLabels,
    stepBackReasonLabels,
    declineReasonLabels,
    legalFormReceiptCorrectionReasonLabels,
    changeReasonLabels,
  ].flatMap((labels): [string, string][] => Object.entries(labels)),
);

/** A reason code in words. A reason that is already a sentence (override reasons) is returned as is. */
export function reasonLabel(reason: string | null | undefined): string {
  if (!reason) return "";
  return REASON_LABELS.get(reason) ?? reason;
}

function finite(value: Instant | null | undefined): Instant | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const UNWIND_LABELS: Record<Movement["unwinds"][number]["kind"], string> = {
  pull_released: "Bed hold released",
  transport_cancelled: "Transport cancelled",
  stage_corrected: "Stage stepped back",
  acceptance_withdrawn: "Acceptance withdrawn",
};

const EXAMINATION_LABELS: Record<NonNullable<Movement["examination"]>["outcome"], string> = {
  inpatient_order: "Inpatient order",
  community_order: "Community order",
  revoked: "Revoked",
  further_examination_ordered: "Further examination ordered",
};

function stageLabel(stage: Movement["stage"] | undefined): string {
  return stage ? (stageCopy[stage]?.label ?? stage) : "";
}

/**
 * The person's own records. Identity is resolved only through the D-14-authorised resolver
 * (`ward-patient-resolver.ts`), which attributes a record to a person through its explicit,
 * unambiguous links and nothing else; this module never reads the patient link itself.
 */
export function patientRecordIds(
  patientId: string,
  patients: readonly Patient[],
  movements: readonly Movement[],
  referrals: readonly Referral[],
  admissions: readonly Admission[],
): PatientChronology["recordIds"] {
  const resolve = createPatientResolver({ patients, referrals, movements });
  const belongs = (record: Movement | Referral | Admission) => resolve(record).patient?.id === patientId;
  return {
    movements: movements.filter(belongs).map((movement) => movement.id),
    referrals: referrals.filter(belongs).map((referral) => referral.id),
    admissions: admissions.filter(belongs).map((admission) => admission.id),
  };
}

/** The ids of everyone with at least one record of their own, resolving each record once. */
export function patientIdsWithRecords(
  patients: readonly Patient[],
  movements: readonly Movement[],
  referrals: readonly Referral[],
  admissions: readonly Admission[],
): ReadonlySet<string> {
  const resolve = createPatientResolver({ patients, referrals, movements });
  const ids = new Set<string>();
  for (const record of [...movements, ...referrals, ...admissions]) {
    const id = resolve(record).patient?.id;
    if (id !== undefined) ids.add(id);
  }
  return ids;
}

/** Internally a draft's `record` is "<kind> <id>", so rows can be matched to their record. */
type RowDraft = Omit<ChronologyRow, "key" | "source" | "before" | "after" | "reason" | "occurredAt"> &
  Partial<Pick<ChronologyRow, "before" | "after" | "reason" | "occurredAt">> & {
    /** The event types that write this row, so a session-log entry for the same act is not repeated. */
    eventTypes?: readonly string[];
  };

/** Every reducer case that appends to `Movement.stageChanges` (`ward-flow-reducer.ts`). */
const STAGE_EVENTS = [
  "REFER_TO_UNITS",
  "ACCEPT_IN_PRINCIPLE",
  "PULL_PATIENT",
  "DECLINE",
  "HANDOVER_READY",
  "PATIENT_COLLECTED",
  "PATIENT_ARRIVED",
  "RELEASE_PULL",
  "STEP_BACK_STAGE",
  "WITHDRAW_ACCEPTANCE",
  "RECORD_ED_MEDICAL_DETERIORATION",
] as const;

/**
 * Which event types write each record row, by the row's action. A session-log entry is a repeat
 * only when it is the same record, the same minute AND one of these types: a different act in the
 * same minute (a transport step beside a stage change) still gets its own row.
 */
const ACTION_EVENT_TYPES: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>(
  Object.entries({
    "Placement request opened": ["RAISE_REFERRAL", "RECORD_ARRIVED_IN_DEPARTMENT"],
    "Referred to wards": ["REFER_TO_UNITS"],
    "Stage changed": STAGE_EVENTS,
    "Legal status changed": ["CHANGE_LEGAL_STATUS"],
    "Urgency changed": ["CHANGE_URGENCY"],
    "Marked urgent": ["FLAG_MOVEMENT_URGENT"],
    "Urgent mark cleared": ["CLEAR_MOVEMENT_URGENT_FLAG"],
    "Placement override": ["REFER_TO_UNITS", "PULL_PATIENT", "ACCEPT_IN_PRINCIPLE", "ACCEPT_REFERRAL"],
    "Placed after checking with the ward": ["REFER_TO_UNITS", "PULL_PATIENT", "ACCEPT_IN_PRINCIPLE"],
    "Ward declined": ["DECLINE"],
    "Ward request withdrawn": ["WITHDRAW_REFERRAL", "WITHDRAW_WARD_REQUEST"],
    Accepted: ["ACCEPT_IN_PRINCIPLE"],
    "Bed hold released": ["RELEASE_PULL", "RELEASE_AND_REOPEN_SEARCH"],
    "Transport cancelled": ["CANCEL_TRANSPORT"],
    "Stage stepped back": ["STEP_BACK_STAGE"],
    "Acceptance withdrawn": ["WITHDRAW_ACCEPTANCE"],
    Escalated: ["RECORD_ESCALATION"],
    "Examination outcome recorded": ["RECORD_EXAMINATION"],
    "Medical clearance recorded": ["RECORD_MOVEMENT_MEDICAL_CLEARANCE", "RECORD_MEDICAL_CLEARANCE"],
    "Form extension recorded": ["RECORD_COUNTRY_EXTENSION", "RECORD_LEGAL_FORM_EXPIRY"],
    "Form expiry recorded": ["RECORD_LEGAL_FORM_EXPIRY", "RECORD_LEGAL_FORM_CONTINUATION"],
    "Form receipt time corrected": ["CORRECT_LEGAL_FORM_RECEIPT"],
    "Arrival details recorded": ["SET_ARRIVAL_DETAILS"],
    "Left the emergency department": ["RECORD_LEFT_DEPARTMENT"],
    "Movement closed": ["PATIENT_ARRIVED", "WITHDRAW_REFERRAL", "RECORD_ED_OUTCOME"],
    "Referral raised": ["RECEIVE_REFERRAL", "RAISE_REFERRAL"],
    "Referral accepted": ["ACCEPT_REFERRAL"],
    "Referral declined": ["DECLINE_REFERRAL"],
    "Referral cancelled": ["ACCEPT_REFERRAL"],
    "Transport need recorded": ["RECORD_TRANSPORT_NEED"],
    "Transport booked": ["BOOK_TRANSPORT"],
    "Transport accepted": ["TRANSPORT_ACCEPTED"],
    "Transport en route": ["TRANSPORT_EN_ROUTE"],
    "Patient collected by transport": ["PATIENT_COLLECTED"],
    "Transport arrived": ["PATIENT_ARRIVED"],
    "Transport diverted": ["RECORD_DIVERSION"],
    "Transport stopped": ["STOP_TRANSPORT"],
    "Transport job closed": ["WITHDRAW_REFERRAL", "RECORD_EXAMINATION", "STOP_TRANSPORT", "RELEASE_DIVERTED_BED"],
    "Document recorded": ["UPLOAD_PATIENT_FORM"],
    "Referral withdrawn by referrer": ["RECORD_REFERRER_WITHDRAWAL"],
    "Bed held": ["PULL_PATIENT"],
    "Arrived on ward": ["PATIENT_ARRIVED"],
    "Expected discharge date set": ["UPDATE_EXPECTED_DISCHARGE"],
    "Discharge confirmed": ["RECORD_PATIENT_DISCHARGE"],
    "Follow-up recorded": ["RECORD_ADMISSION_FOLLOW_UP"],
    "Left the ward": ["RECORD_LEAVING", "RECORD_PATIENT_DISCHARGE"],
  }),
);

function movementRows(movement: Movement, units: readonly Unit[], dayZero: Date): RowDraft[] {
  const unitName = (id: string | undefined) => (id ? (units.find((unit) => unit.id === id)?.name ?? id) : "");
  const record = `Movement ${movement.id}`;
  const rows: RowDraft[] = [];
  const add = (row: Omit<RowDraft, "record">) => rows.push({ record, ...row });

  add({
    recordedAt: finite(movement.openedAt),
    who: NOT_RECORDED,
    action: "Placement request opened",
    after: edById(movement.originEdId)?.name ?? movement.originEdId,
  });
  if (finite(movement.referredAt) !== null && movement.referredUnitIds.length > 0) {
    add({
      recordedAt: finite(movement.referredAt),
      who: NOT_RECORDED,
      action: "Referred to wards",
      after: movement.referredUnitIds.map(unitName).join(", "),
    });
  }
  for (const change of movement.stageChanges) {
    add({
      recordedAt: finite(change.at),
      who: whoLabel(change.by),
      action: "Stage changed",
      before: stageLabel(change.from),
      after: stageLabel(change.to),
      reason: reasonLabel(change.reason),
    });
  }
  for (const change of movement.statusChanges) {
    add({
      recordedAt: finite(change.at),
      who: whoLabel(change.by),
      action: "Legal status changed",
      before: change.from,
      after: change.to,
      reason: reasonLabel(change.reason),
    });
  }
  for (const change of movement.urgencyChanges) {
    add({
      recordedAt: finite(change.at),
      who: whoLabel(change.by),
      action: "Urgency changed",
      before: `Urgency ${change.from}`,
      after: `Urgency ${change.to}`,
      reason: reasonLabel(change.reason),
    });
  }
  for (const flag of movement.urgentFlagHistory ?? []) {
    add({
      recordedAt: finite(flag.raisedAt),
      who: whoLabel(flag.raisedBy),
      action: "Marked urgent",
      reason: reasonLabel(flag.reason),
    });
    if (finite(flag.clearedAt) !== null) {
      add({ recordedAt: finite(flag.clearedAt), who: whoLabel(flag.clearedBy), action: "Urgent mark cleared" });
    }
  }
  for (const override of movement.overrides) {
    add({
      recordedAt: finite(override.at),
      who: whoLabel(override.by),
      action: "Placement override",
      after: override.unitIds.map(unitName).join(", "),
      reason: override.reason,
    });
  }
  for (const placement of movement.genderPlacements ?? []) {
    add({
      recordedAt: finite(placement.at),
      who: whoLabel(placement.by),
      action: "Placed after checking with the ward",
      after: placement.unitIds.map(unitName).join(", "),
      reason: reasonLabel(placement.reason),
    });
  }
  for (const decline of movement.declines) {
    add({
      recordedAt: finite(decline.at),
      who: NOT_RECORDED,
      action: "Ward declined",
      after: unitName(decline.unitId),
      reason: reasonLabel(decline.reason),
    });
  }
  for (const withdrawal of movement.withdrawnReferrals) {
    add({
      recordedAt: finite(withdrawal.at),
      who: NOT_RECORDED,
      action: "Ward request withdrawn",
      after: unitName(withdrawal.unitId),
      reason: reasonLabel(withdrawal.detail ?? withdrawal.reason),
    });
  }
  if (movement.acceptedUnitId && finite(movement.acceptedAt) !== null) {
    add({
      recordedAt: finite(movement.acceptedAt),
      who: NOT_RECORDED,
      action: "Accepted",
      after: unitName(movement.acceptedUnitId),
    });
  }
  for (const unwind of movement.unwinds) {
    add({
      recordedAt: finite(unwind.at),
      who: whoLabel(unwind.by),
      action: UNWIND_LABELS[unwind.kind],
      after: unitName(unwind.unitId),
      reason: reasonLabel(unwind.reason),
    });
  }
  if (movement.escalation) {
    add({
      recordedAt: finite(movement.escalation.at),
      who: NOT_RECORDED,
      action: "Escalated",
      after: movement.escalation.contact,
    });
  }
  for (const examination of [
    ...(movement.supersededExaminations ?? []),
    ...(movement.examination ? [movement.examination] : []),
  ]) {
    add({
      recordedAt: finite(examination.at),
      who: NOT_RECORDED,
      action: "Examination outcome recorded",
      after: EXAMINATION_LABELS[examination.outcome],
    });
  }
  if (movement.medicalClearance) {
    add({
      recordedAt: finite(movement.medicalClearance.at),
      who: NOT_RECORDED,
      action: "Medical clearance recorded",
      after: movement.medicalClearance.cleared ? "Cleared" : "Not cleared",
    });
  }
  if (movement.legalForm) {
    const form = legalFormName(movement.legalForm);
    if (finite(movement.formedAt) !== null) {
      add({
        occurredAt: finite(movement.formedAt),
        recordedAt: null,
        who: NOT_RECORDED,
        action: "Legal form made (typed time)",
        after: form,
      });
    }
    if (finite(movement.legalFormReceivedAt) !== null) {
      add({
        occurredAt: finite(movement.legalFormReceivedAt),
        recordedAt: null,
        who: NOT_RECORDED,
        action: "Legal form received (typed time)",
        after: form,
      });
    }
  }
  for (const expiry of movement.legalFormExpiryHistory ?? []) {
    add({
      recordedAt: finite(expiry.at),
      who: whoLabel(expiry.by),
      action: expiry.basis === "extension" ? "Form extension recorded" : "Form expiry recorded",
      after: `Typed expiry ${formatSheetMoment(expiry.dueAt, dayZero)}`,
    });
  }
  for (const correction of movement.legalFormReceiptCorrections ?? []) {
    add({
      recordedAt: finite(correction.at),
      who: whoLabel(correction.by),
      action: "Form receipt time corrected",
      before: chronologyTime(finite(correction.receivedAt), dayZero),
      after: "Cleared",
      reason: reasonLabel(correction.reason),
    });
  }
  if (movement.arrivalDetails) {
    add({
      recordedAt: finite(movement.arrivalDetails.recordedAt),
      who: whoLabel(movement.arrivalDetails.recordedBy),
      action: "Arrival details recorded",
    });
  }
  if (movement.transportNeed) {
    add({
      recordedAt: finite(movement.transportNeed.at),
      who: NOT_RECORDED,
      action: "Transport need recorded",
      after: movement.transportNeed.needed ? "Needed" : "Not needed",
    });
  }
  rows.push(...transportRows(movement, record, dayZero));
  for (const form of movement.uploadedForms ?? []) {
    add({
      recordedAt: finite(form.uploadedAt),
      who: whoLabel(form.uploadedBy),
      action: "Document recorded",
      after: form.formName,
    });
  }
  if (finite(movement.leftDepartmentAt) !== null) {
    add({ recordedAt: finite(movement.leftDepartmentAt), who: NOT_RECORDED, action: "Left the emergency department" });
  }
  if (movement.closure) {
    add({
      recordedAt: finite(movement.closure.at),
      who: NOT_RECORDED,
      action: "Movement closed",
      after: movement.closure.outcome === "arrived" ? "Arrived" : "Did not proceed",
    });
  }
  return rows;
}

/**
 * The current transport job's recorded steps. The job keeps no booking time, so the booking row
 * carries none (the session log shows when it was logged in this browser); every other row uses the
 * step's own recorded instant. A job replaced by CANCEL_TRANSPORT appears as its unwind row.
 */
function transportRows(movement: Movement, record: string, dayZero: Date): RowDraft[] {
  const job = movement.transport;
  if (!job) return [];
  const rows: RowDraft[] = [];
  const legal = job.transportLegalStatus
    ? `, ${job.transportLegalStatus === "involuntary" ? "Involuntary" : "Voluntary"}`
    : "";
  const eta = finite(job.estimatedAt) !== null ? `, typed ETA ${formatSheetMoment(job.estimatedAt!, dayZero)}` : "";
  rows.push({
    record,
    recordedAt: null,
    who: whoLabel(job.bookedBy?.role ?? job.bookedByRole),
    action: "Transport booked",
    after: `${job.provider}${job.escortRequired ? ", escort required" : ""}${legal}${eta}`,
  });
  const steps: [string, Instant | undefined][] = [
    ["Transport accepted", job.acceptedAt],
    ["Transport en route", job.enRouteAt],
    ["Patient collected by transport", job.collectedAt],
    ["Transport arrived", job.arrivedAt],
  ];
  for (const [action, at] of steps) {
    if (finite(at) !== null) rows.push({ record, recordedAt: finite(at), who: NOT_RECORDED, action });
  }
  if (job.diversion) {
    rows.push({
      record,
      recordedAt: finite(job.diversion.at),
      who: whoLabel(job.diversion.by),
      action: "Transport diverted",
      after: job.diversion.place,
      reason: job.diversion.reason,
    });
  }
  if (finite(job.stoppedAt) !== null) {
    rows.push({
      record,
      recordedAt: finite(job.stoppedAt),
      who: whoLabel(job.stoppedBy),
      action: "Transport stopped",
      after: job.stoppedWhereabouts ?? "",
      reason: job.stopReason ?? "",
    });
  } else if (finite(job.cancelledAt) !== null) {
    rows.push({ record, recordedAt: finite(job.cancelledAt), who: NOT_RECORDED, action: "Transport job closed" });
  }
  return rows;
}

function referralRows(referral: Referral, units: readonly Unit[]): RowDraft[] {
  const record = `Referral ${referral.id}`;
  const rows: RowDraft[] = [
    { record, recordedAt: finite(referral.raisedAt), who: NOT_RECORDED, action: "Referral raised" },
  ];
  for (const addressing of referral.destinations) {
    const destination = addressing.destination;
    const place =
      destination.kind === "psychiatric_ward" && destination.unitId
        ? (units.find((unit) => unit.id === destination.unitId)?.name ?? destination.unitId)
        : destination.kind.replaceAll("_", " ");
    if (addressing.state === "accepted" || addressing.state === "declined") {
      rows.push({
        record,
        recordedAt: finite(addressing.decidedAt),
        who: whoLabel(addressing.decidedBy),
        action: addressing.state === "accepted" ? "Referral accepted" : "Referral declined",
        after: place,
        reason:
          addressing.state === "accepted"
            ? (addressing.acceptOverrideReason ?? "")
            : reasonLabel(addressing.declineReason),
      });
    }
    if (addressing.state === "cancelled") {
      // Nobody decided this: another destination accepted first (FD-22). `decidedBy` is absent by
      // design, so the row names no role rather than implying a refusal.
      rows.push({
        record,
        recordedAt: finite(addressing.decidedAt),
        who: "No one (automatic)",
        action: "Referral cancelled",
        after: place,
        reason: "Accepted somewhere else",
      });
    }
    if (finite(addressing.withdrawnAt) !== null) {
      rows.push({
        record,
        recordedAt: finite(addressing.withdrawnAt),
        who: whoLabel(addressing.withdrawalRecordedBy),
        action: "Referral withdrawn by referrer",
        after: place,
      });
    }
  }
  return rows;
}

function admissionRows(admission: Admission, units: readonly Unit[]): RowDraft[] {
  const record = `Admission ${admission.id}`;
  const ward = units.find((unit) => unit.id === admission.unitId)?.name ?? admission.unitId;
  const rows: RowDraft[] = [];
  if (finite(admission.pulledAt) !== null) {
    rows.push({ record, recordedAt: finite(admission.pulledAt), who: NOT_RECORDED, action: "Bed held", after: ward });
  }
  if (finite(admission.arrivedAt) !== null) {
    rows.push({
      record,
      recordedAt: finite(admission.arrivedAt),
      who: NOT_RECORDED,
      action: "Arrived on ward",
      after: ward,
    });
  }
  if (finite(admission.dischargeDateSetAt) !== null) {
    rows.push({
      record,
      recordedAt: finite(admission.dischargeDateSetAt),
      who: whoLabel(admission.dischargeDateSetBy),
      action: "Expected discharge date set",
    });
  }
  if (finite(admission.dischargeConfirmedAt) !== null) {
    rows.push({
      record,
      recordedAt: finite(admission.dischargeConfirmedAt),
      who: whoLabel(admission.dischargeConfirmedBy),
      action: "Discharge confirmed",
    });
  }
  if (admission.followUp && finite(admission.followUp.recordedAt) !== null) {
    rows.push({
      record,
      recordedAt: finite(admission.followUp.recordedAt),
      who: whoLabel(admission.followUp.recordedBy),
      action: "Follow-up recorded",
      after: admission.followUp.state.replaceAll("_", " "),
    });
  }
  if (finite(admission.leftAt) !== null) {
    rows.push({
      record,
      recordedAt: finite(admission.leftAt),
      who: NOT_RECORDED,
      action: "Left the ward",
      after: admission.leavingDestination ? admission.leavingDestination.replaceAll("_", " ") : "",
    });
  }
  return rows;
}

function auditRecord(event: AuditEvent): string | null {
  const subject = event.subject;
  if (subject.kind === "movement") return `Movement ${subject.movementId}`;
  if (subject.kind === "referral") return `Referral ${subject.referralId}`;
  if (subject.kind === "admission") return `Admission ${subject.admissionId}`;
  return null;
}

function auditBeforeAfter(event: AuditEvent): Pick<ChronologyRow, "before" | "after" | "reason"> {
  switch (event.category) {
    case "legal-status":
      return { before: event.details.before ?? "", after: event.details.after ?? "", reason: "" };
    case "override":
    case "referral":
      return {
        before: "",
        after: event.details.targets.map((target) => `${target.unitId ?? NOT_RECORDED} ${target.outcome}`).join(", "),
        reason: event.details.reason ?? "",
      };
    case "discharge": {
      const details = event.details;
      if (details.kind === "follow-up" || details.kind === "departure") {
        return { before: details.before ?? "", after: details.after ?? "", reason: "" };
      }
      if (details.kind === "bed-release") {
        return { before: details.before?.state ?? "", after: details.after?.state ?? "", reason: "" };
      }
      return { before: "", after: details.operation ?? "", reason: "" };
    }
    case "legal-form":
      return { before: "", after: "formCode" in event.details ? (event.details.formCode ?? "") : "", reason: "" };
    default:
      return { before: "", after: "", reason: "" };
  }
}

function auditRows(events: readonly AuditEvent[], recordKeys: Set<string>): RowDraft[] {
  const rows: RowDraft[] = [];
  for (const event of events) {
    const record = auditRecord(event);
    if (record === null || !recordKeys.has(record)) continue;
    const wording = EVENT_HISTORY_TABLE[event.action as keyof typeof EVENT_HISTORY_TABLE]?.plainWording ?? event.action;
    const outcome =
      event.outcome === "accepted"
        ? ""
        : ` (${event.outcome}${event.reasonCode === "none" ? "" : `: ${event.reasonCode}`})`;
    rows.push({
      record,
      recordedAt: finite(event.at),
      who: whoLabel(event.actor.role),
      action: `${wording}${outcome}`,
      eventTypes: [event.action],
      ...auditBeforeAfter(event),
    });
  }
  return rows;
}

function logRecord(entry: EventLogEntry, ids: PatientChronology["recordIds"]): string | null {
  if (entry.movementId && ids.movements.includes(entry.movementId)) return `Movement ${entry.movementId}`;
  if (entry.referralId && ids.referrals.includes(entry.referralId)) return `Referral ${entry.referralId}`;
  if (entry.admissionId && ids.admissions.includes(entry.admissionId)) return `Admission ${entry.admissionId}`;
  return null;
}

function sortInstant(row: ChronologyRow): number {
  return row.occurredAt ?? row.recordedAt ?? Number.POSITIVE_INFINITY;
}

export function patientChronology(input: ChronologyInput): PatientChronology {
  const { personId, units } = input;
  const patient = input.patients.find((candidate) => candidate.id === personId);
  const recordIds = patientRecordIds(personId, input.patients, input.movements, input.referrals, input.admissions);
  const pick = <T extends { id: string }>(list: readonly T[], ids: string[]) =>
    list.filter((item) => ids.includes(item.id));

  const drafts: { draft: RowDraft; source: ChronologySource }[] = [
    ...pick(input.referrals, recordIds.referrals).flatMap((referral) => referralRows(referral, units)),
    ...pick(input.movements, recordIds.movements).flatMap((movement) => movementRows(movement, units, input.dayZero)),
    ...pick(input.admissions, recordIds.admissions).flatMap((admission) => admissionRows(admission, units)),
  ].map((draft) => ({ draft, source: "Record" as const }));

  const recordKeys = new Set([
    ...recordIds.movements.map((id) => `Movement ${id}`),
    ...recordIds.referrals.map((id) => `Referral ${id}`),
    ...recordIds.admissions.map((id) => `Admission ${id}`),
  ]);
  if (input.auditEvents) {
    for (const draft of auditRows(input.auditEvents, recordKeys)) drafts.push({ draft, source: "Audit" });
  }

  // A session act already shown on the same record, at the same moment, as the same act is not
  // repeated. A different act in the same minute keeps its own row.
  const seen = new Set(
    drafts.flatMap(({ draft }) =>
      (draft.eventTypes ?? ACTION_EVENT_TYPES.get(draft.action) ?? []).map(
        (type) => `${draft.record}@${draft.recordedAt ?? draft.occurredAt}@${type}`,
      ),
    ),
  );
  for (const entry of input.eventLog) {
    const record = logRecord(entry, recordIds);
    const at = finite(entry.now);
    if (record === null) continue;
    if (entry.accepted && seen.has(`${record}@${at}@${entry.type}`)) continue;
    const wording = EVENT_HISTORY_TABLE[entry.type]?.plainWording ?? entry.type;
    const action = entry.accepted ? wording : `${wording} (refused)`;
    drafts.push({
      draft: {
        record,
        recordedAt: at,
        who: whoLabel(entry.role),
        action,
      },
      source: "Session log",
    });
  }

  const rows = drafts
    .map(({ draft, source }, index) => ({
      key: `${source}-${index}`,
      occurredAt: draft.occurredAt ?? draft.recordedAt,
      recordedAt: draft.recordedAt,
      who: draft.who,
      action: draft.action,
      record: draft.record.split(" ")[0] ?? draft.record,
      before: draft.before ?? "",
      after: draft.after ?? "",
      reason: draft.reason ?? "",
      source,
    }))
    .map((row, index) => ({ row, index }))
    .sort((a, b) => sortInstant(a.row) - sortInstant(b.row) || a.index - b.index)
    .map(({ row }) => row);

  return { patient, recordIds, rows, auditIncluded: input.auditEvents !== null };
}

/** A time for paper or a spreadsheet: weekday, date and clock face, or "Not recorded". */
export function chronologyTime(instant: Instant | null, dayZero: Date): string {
  return instant === null ? NOT_RECORDED : formatSheetMoment(instant, dayZero);
}

export const CHRONOLOGY_CSV_HEADER = [
  "Occurred",
  "Recorded",
  "Who (role)",
  "Action",
  "Record",
  "Before",
  "After",
  "Reason",
  "Source",
] as const;

/**
 * The chronology as CSV. The first line says it is synthetic demo data, so a downloaded copy can
 * never be mistaken for a real record.
 */
/**
 * `patient` is the person as the screen names them (`patientDisplayName` and UMRN), so a downloaded
 * copy says whose chronology it is; it is never a record id.
 */
export function chronologyCsv(
  rows: readonly ChronologyRow[],
  dayZero: Date,
  generatedAt: Instant,
  patient?: string,
): string {
  const lines = [
    [
      csvCell("Synthetic demo data. Not a clinical record."),
      csvCell(`Generated ${formatSheetMoment(generatedAt, dayZero)}`),
    ].join(","),
    ...(patient ? [[csvCell("Patient"), csvCell(patient)].join(",")] : []),
    CHRONOLOGY_CSV_HEADER.map(csvCell).join(","),
    ...rows.map((row) =>
      [
        chronologyTime(row.occurredAt, dayZero),
        chronologyTime(row.recordedAt, dayZero),
        row.who,
        row.action,
        row.record,
        row.before,
        row.after,
        row.reason,
        row.source,
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  return `${lines.join("\r\n")}\r\n`;
}
