/**
 * Admission arrival checklist (Top 25 item 14).
 *
 * Lists what the receiving ward wants settled before a patient arrives, read from the recorded
 * medical clearance, legal form receipt, transport need, contraband search and medication chart.
 * The search and the chart are recorded with `RECORD_ARRIVAL_CHECK` (D-72); this view only reads.
 * Nothing here blocks the handover: the reducer's own `HANDOVER_READY` rules are unchanged.
 *
 * Feature item 15 (D-134): up to three more lines, each shown only when it applies and never
 * pre-ticked. "Interpreter booked" when the patient record says an interpreter is required;
 * "Aboriginal liaison offered" when the recorded identity is Aboriginal, Torres Strait Islander or
 * both (offered, never assumed); "Mental Health Advocacy Service told" for every move the app treats
 * as detained, read from the same `RECORD_SUPPORT_NOTIFICATION` record (party `mhas`) the support
 * checklist and the Notifications alert read. PROVISIONAL wording, pending the Aboriginal cultural
 * safety review (audit M122, D-123 item 6).
 */
import {
  recordedAboriginalIdentity,
  recordedInterpreterLanguage,
} from "@/components/ward-management/ward-arrival-support-lines";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { transportNeedState } from "@/components/ward-management/ward-derivations";
import { requiresAuthorisedDestination } from "@/components/ward-management/ward-eligibility";
import { legalStatusIsDetained } from "@/components/ward-management/ward-legal-status";
import { recordedMovementMedicalClearance } from "@/components/ward-management/ward-medical-clearance";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import {
  movementSupportNotificationBeforeArrival,
  movementSupportNotificationSubject,
  supportNotificationChecklist,
  type SupportNotificationOccasion,
  type SupportNotificationRecord,
} from "@/components/ward-management/ward-support-notifications";

type AdmissionChecklistState = "done" | "outstanding";

export type AdmissionChecklistItem = {
  key:
    | "medical_clearance"
    | "legal_form"
    | "transport"
    | "contraband_search"
    | "medication_chart"
    | "interpreter_booked"
    | "aboriginal_liaison_offered"
    | "mhas_told";
  label: string;
  state: AdmissionChecklistState;
  detail: string;
  /** `mhas_told` only: the support notification record this line reads and writes. */
  supportNotification?: { occasion: SupportNotificationOccasion; subjectId: string };
};

/** @deprecated Local drafts cannot establish recorded checklist completion. */
export type AdmissionChecklistOverrides = {
  contraband_search?: boolean;
  medication_chart?: boolean;
};

/** Item 15: what the three conditional lines read. Absent, they are simply not offered. */
export type AdmissionChecklistContext = {
  patient?: Pick<Patient, "interpreterLanguage" | "aboriginalOrTorresStraitIslanderStatus">;
  supportNotifications?: readonly SupportNotificationRecord[];
  now?: Instant;
};

function interpreterLine(movement: Movement, { patient }: AdmissionChecklistContext): AdmissionChecklistItem[] {
  const language = recordedInterpreterLanguage(patient);
  if (language === undefined) return [];
  const booked = movement.interpreterBooked === true;
  return [
    {
      key: "interpreter_booked",
      label: "Interpreter booked",
      state: booked ? "done" : "outstanding",
      detail: booked ? `${language} interpreter booked` : `${language} · not recorded`,
    },
  ];
}

/**
 * The liaison line names no identity: the line itself is enough, and R-2026-09-04-A keeps identity
 * and interpreter language apart wherever both show, so this line also never sits next to the
 * interpreter line.
 */
function liaisonLine(movement: Movement, { patient }: AdmissionChecklistContext): AdmissionChecklistItem[] {
  if (recordedAboriginalIdentity(patient) === undefined) return [];
  const offered = movement.aboriginalLiaisonOffered === true;
  return [
    {
      key: "aboriginal_liaison_offered",
      label: "Aboriginal liaison offered",
      state: offered ? "done" : "outstanding",
      detail: offered ? "Offered" : "Not recorded",
    },
  ];
}

/** D-134 item 2: every move the app treats as detained, the same group the support checklist covers. */
function advocacyLine(
  movement: Movement,
  referrals: readonly Referral[],
  { supportNotifications, now }: AdmissionChecklistContext,
): AdmissionChecklistItem[] {
  if (!legalStatusIsDetained(movement.legalStatus)) return [];
  const subject =
    movementSupportNotificationBeforeArrival(movement, referrals) ??
    movementSupportNotificationSubject(movement, referrals);
  const record = subject
    ? supportNotificationChecklist(supportNotifications, subject.occasion, subject.subjectId).mhas
    : undefined;
  const when =
    record?.outcome === "told" && now !== undefined
      ? ` · ${formatInstantWithDay(record.contactedAt ?? record.at, now)}`
      : "";
  return [
    {
      key: "mhas_told",
      label: "Mental Health Advocacy Service told",
      state: record === undefined ? "outstanding" : "done",
      detail:
        record === undefined
          ? "Not recorded"
          : record.outcome === "told"
            ? `Told ${record.who ?? ""}${when}`
            : `Not applicable · ${record.reason ?? ""}`,
      ...(subject ? { supportNotification: { occasion: subject.occasion, subjectId: subject.subjectId } } : {}),
    },
  ];
}

export function admissionChecklist(
  movement: Movement,
  referrals: readonly Referral[],
  /** @deprecated Ignored: only recorded movement values establish completion. */
  _overrides?: AdmissionChecklistOverrides,
  context: AdmissionChecklistContext = {},
): AdmissionChecklistItem[] {
  void _overrides;
  const clearance = recordedMovementMedicalClearance(movement, referrals);
  const transportNeed = transportNeedState(movement);
  const transportBooked = movement.transport !== undefined && movement.transport.cancelledAt === undefined;
  // No form on the record is settled only when the legal status needs none.
  const formNeeded = movement.legalForm === undefined && requiresAuthorisedDestination(movement.legalStatus);
  const contrabandDone = movement.contrabandSearchDone;
  const medChartDone = movement.medicationChartDone;
  return [
    {
      key: "medical_clearance",
      label: "Medical clearance",
      state: clearance?.cleared === true ? "done" : "outstanding",
      detail:
        clearance === undefined ? "Not recorded" : clearance.cleared ? "Medically cleared" : "Recorded as not cleared",
    },
    {
      key: "legal_form",
      label: "Legal form received",
      state:
        !formNeeded && (movement.legalForm === undefined || movement.legalFormReceivedAt !== undefined)
          ? "done"
          : "outstanding",
      detail: formNeeded
        ? "Legal form not on this record"
        : movement.legalForm === undefined
          ? "No legal form needed on this record"
          : movement.legalFormReceivedAt !== undefined
            ? `Form ${movement.legalForm.code} received`
            : `Form ${movement.legalForm.code} not marked received`,
    },
    {
      key: "transport",
      label: "Transport",
      state: transportNeed === "not_needed" || transportBooked ? "done" : "outstanding",
      detail:
        transportNeed === "not_needed"
          ? "No transport needed"
          : transportBooked
            ? "Transport booked"
            : transportNeed === "needed"
              ? "Needed, not booked"
              : "Need not recorded",
    },
    ...interpreterLine(movement, context),
    {
      key: "contraband_search",
      label: "Contraband search",
      state: contrabandDone === true ? "done" : "outstanding",
      detail: contrabandDone === true ? "Checked in ED" : "Not recorded",
    },
    {
      key: "medication_chart",
      label: "Medication chart",
      state: medChartDone === true ? "done" : "outstanding",
      detail: medChartDone === true ? "Ready for ward" : "Not recorded",
    },
    ...liaisonLine(movement, context),
    ...advocacyLine(movement, referrals, context),
  ];
}
