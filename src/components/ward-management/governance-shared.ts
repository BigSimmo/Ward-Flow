// The governance workbench's shared types, label tables and small formatters, split out of
// `governance-registers.tsx` (18 October 2026) to keep that file under the line cap.

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import type { useWardFlow } from "./ward-flow-provider";
import type { AuditCategory, AuditEvent } from "./ward-audit";
import { LEAVING_DESTINATIONS } from "./ward-admissions";
import type { WfTone } from "@/components/wf";

/** The hero's Overrides figure counts this session's override events waiting in Review; the register
 *  below lists overrides saved on a movement. Say so in the register, so the two never read as one
 *  figure that disagrees with itself (audit settings-2, 13 Oct 2026). */
export function sessionOverrideSentence(count: number): string {
  return count === 0
    ? "No override event from this session waits in Review."
    : `${count} override ${count === 1 ? "event" : "events"} from this session ${count === 1 ? "waits" : "wait"} in Review.`;
}

export type GovernanceApi = Pick<
  ReturnType<typeof useWardFlow>,
  "worldGeneration" | "readAuditEvents" | "readAuditReviews" | "dispatch" | "admissions" | "bedReleases"
> &
  Partial<Pick<ReturnType<typeof useWardFlow>, "readGovernanceAuditEvents" | "rejections">>;

/** Governance reads the captured log plus the synthetic seeded entries (pass 2 engine), so the
 *  Review tab has something to review on a fresh seed. Older hand-built contexts fall back. */
export function readGovernanceEvents(api: GovernanceApi | undefined) {
  return api?.readGovernanceAuditEvents?.(actor) ?? api?.readAuditEvents(actor);
}
export type WorkbenchProps = {
  movements: Movement[];
  units: Unit[];
  now: Instant;
  api?: GovernanceApi;
  sampleData?: boolean;
};
export const actor = { role: "coordinator" } as const;
export const categoryLabels: Record<AuditCategory, string> = {
  referral: "Referral",
  override: "Override",
  "legal-status": "Legal status",
  "legal-form": "Legal form",
  discharge: "Discharge",
  "record-access": "Record access",
  review: "Review",
  configuration: "Configuration",
  inbox: "Action item",
  undo: "Undo",
  "bed-placement": "Bed move",
};
export const outcomeLabels = {
  accepted: "Accepted",
  partial: "Partly accepted",
  denied: "Refused",
  stale: "Stale request",
} as const;
export const reasonLabels: Record<AuditEvent["reasonCode"], string> = {
  none: "None",
  role: "Role not permitted",
  scope: "Outside permitted scope",
  "missing-or-inaccessible": "Missing or inaccessible record",
  "invalid-payload": "Invalid request",
  "identity-link": "Patient link did not match",
  generation: "Session changed",
  revision: "Record changed",
  transition: "Transition not permitted",
};
export const actionLabels: Record<AuditEvent["action"], string> = {
  REFER_TO_UNITS: "Refer to wards",
  PULL_PATIENT: "Pull bed",
  ACCEPT_IN_PRINCIPLE: "Accept in principle",
  ACCEPT_REFERRAL: "Accept referral",
  HOLD_REFERRAL_BED: "Hold referral bed",
  CHANGE_LEGAL_STATUS: "Change legal status",
  RAISE_REFERRAL: "Record legal form",
  // T2 (2026-09-17 build plan). Covers both the first typed expiry and a later extension — see
  // `legalFormOperationLabels` below for which of the two this row was.
  RECORD_COUNTRY_EXTENSION: "Country paper extension",
  RECORD_LEGAL_FORM_CONTINUATION: "Paper continuation",
  RECORD_LEGAL_FORM_EXPIRY: "Record legal form expiry",
  // T4 (2026-09-17 build plan).
  CORRECT_LEGAL_FORM_RECEIPT: "Correct legal form receipt",
  FLAG_BED_RELEASE: "Plan bed release",
  CONFIRM_BED_RELEASE: "Confirm bed release",
  REVERT_BED_RELEASE: "Revert bed release",
  BLOCK_BED_RELEASE: "Record release blocker",
  CLEAR_BED_RELEASE_BLOCK: "Clear release blocker",
  SET_BED_PREPARATION: "Update bed preparation",
  RELEASE_BED: "Release bed",
  SEND_RELEASE_SUPPORT_NOTICE: "Send discharge support notice",
  RECORD_LEAVING: "Record departure",
  RECORD_ADMISSION_CARE: "Care journey fact",
  RECORD_ADMISSION_FOLLOW_UP: "Record follow-up arrangement",
  RECORD_PATIENT_DISCHARGE: "Record patient discharge",
  OPEN_DISCHARGE_RECORD: "Open discharge record",
  REVIEW_AUDIT_EVENT: "Review event",
  SET_CONFIGURATION: "Change configuration",
  TAKE_INBOX_ITEM_OWNERSHIP: "Take action item",
  SNOOZE_INBOX_ITEM: "Snooze action item",
  UNSNOOZE_INBOX_ITEM: "Return snoozed action item",
  UNDO_REFERRAL_DECISION: "Undo referral decision",
  UNDO_AUDIT_REVIEW: "Undo review",
  PLACE_IN_BED: "Move to bed",
  UNDO_PLACE_IN_BED: "Undo bed move",
  UNDO_REFER_TO_UNITS: "Undo referral to wards",
  UNDO_ACCEPT_IN_PRINCIPLE: "Undo acceptance",
  UNDO_LEGAL_FORM_RECORD: "Undo legal form record",
  UNDO_SUPPORT_NOTIFICATION: "Undo Tell record",
  UNDO_REPATRIATION: "Undo repatriation",
  UNDO_HANDOVER_SIGN_OFF: "Undo handover sign-off",
  UNDO_ED_STEP: "Undo ED step",
  UNDO_TRANSPORT_STEP: "Undo transport step",
  UNDO_DEPARTURE: "Undo departure",
  UNDO_ABSENT_WITHOUT_LEAVE: "Undo mark absent",
  UNDO_BED_MEETING_ACTION: "Undo bed meeting action done",
};
/** v10 pass 3: the step an undo took back, in words. */
export const UNDONE_STEP_LABELS: Partial<Record<string, string>> = {
  REFER_TO_UNITS: "Refer to wards",
  ACCEPT_IN_PRINCIPLE: "Accept in principle",
  RECORD_LEGAL_FORM_WRITTEN: "Record form written",
  RECORD_LEGAL_FORM_RECEIVED: "Mark form received",
  RECORD_SUPPORT_NOTIFICATION: "Carer, PSP or MHAS record",
  RECORD_ABSENT_WITHOUT_LEAVE: "Mark absent",
  COMPLETE_BED_MEETING_ACTION: "Mark bed meeting action done",
  RECORD_REPATRIATION: "Repatriation record",
  RECORD_HANDOVER_SIGN_OFF: "Handover sign-off",
  RECORD_ARRIVED_IN_DEPARTMENT: "Arrived in the department",
  RECORD_EXAMINATION: "Examination recorded",
  RECORD_MEDICAL_CLEARANCE: "Medical clearance",
  RECORD_TRANSPORT_NEED: "Transport need",
  HANDOVER_READY: "Handover ready",
  TRANSPORT_ACCEPTED: "Transport accepted",
  TRANSPORT_EN_ROUTE: "Transport en route",
  PATIENT_COLLECTED: "Patient collected",
  PATIENT_ARRIVED: "Patient arrived",
};
export const reviewLabels = { reviewed: "Reviewed", "follow-up-required": "Follow-up required" } as const;
export const display = (value: string | number | boolean | null | undefined) =>
  value === null || value === undefined
    ? "Not recorded"
    : typeof value === "boolean"
      ? value
        ? "Yes"
        : "No"
      : String(value);
export const when = (at: Instant | null, now: Instant) =>
  at === null ? "Time unavailable" : formatInstantWithDay(at, now);
export const destination = (id: string | null) =>
  LEAVING_DESTINATIONS.find((entry) => entry.id === id)?.label ?? "Not recorded";
/**
 * The record's person and UMRN (v10: "No raw internal ids. Patients by UMRN."). A movement or a
 * referral resolves through its own episode link; an admission through its record. A record with no
 * linked person reads in words, never as an internal id.
 */
export function subjectPerson(
  event: AuditEvent,
  patientOf: ReturnType<typeof usePatientOf>,
): { name: string; umrn: string } | null {
  const subject = event.subject;
  const info =
    subject.kind === "movement"
      ? patientOf({ movementId: subject.movementId })
      : subject.kind === "referral"
        ? patientOf({ referralId: subject.referralId })
        : subject.kind === "admission"
          ? patientOf({ id: subject.admissionId })
          : null;
  if (!info) return null;
  return info.patient ? { name: info.displayName, umrn: info.umrn } : null;
}
export function subjectLabel(event: AuditEvent, patientOf: ReturnType<typeof usePatientOf>): string {
  const subject = event.subject;
  const person = subjectPerson(event, patientOf);
  if (person) return person.name;
  switch (subject.kind) {
    case "admission":
      return "Bed record, UMRN not recorded";
    case "movement": {
      // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
      return patientOf({ movementId: subject.movementId }).displayName;
    }
    case "referral":
      return "Referral, UMRN not recorded";
    case "bed-release":
      return subject.releaseId;
    case "audit-event":
      return subject.eventId;
    case "configuration":
      return "Configuration";
    case "unresolved":
      return "Unresolved record";
  }
}

/**
 * GOVERNANCE (Tabs, owner pick 9 Oct 2026). Oversight across everyone, after the fact: what waits
 * for review, which sites have gaps on the form or in who was told, the audit trail, the registers
 * and the reports. No live clocks and no record buttons for forms here; a name opens Forms, where
 * the live work is.
 */
export type GovernanceTab = "review" | "gaps" | "audit" | "registers" | "reports";
export type ReviewChip = "override" | "refused" | "access" | "follow-up";

export const FORMS_HREF = "/ward-flow/legal-forms";

export const REVIEWING_ROLES = [
  "Clinical Director",
  "Duty Consultant Psychiatrist",
  "Governance Lead Psychiatrist",
  "Executive Director of Clinical Services",
] as const;
export const OUTCOME_TONE: Record<keyof typeof outcomeLabels, WfTone> = {
  accepted: "success",
  partial: "warning",
  denied: "closed",
  stale: "neutral",
};
