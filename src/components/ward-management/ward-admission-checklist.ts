/**
 * Admission arrival checklist (Top 25 item 14, flag `top25-admission-checklist`).
 *
 * A read-only list of what the receiving ward wants settled before a patient arrives, read from
 * facts the record already holds. It replaces the showcase's four free-standing booleans
 * (`derivePreFlightAdmissionsPacket`) with the recorded medical clearance, legal form receipt and
 * transport need. The contraband search and medication chart have no record in this prototype, so
 * they are listed as not wired rather than ticked. Nothing here blocks the handover: the reducer's
 * own `HANDOVER_READY` rules are unchanged.
 */
import { transportNeedState } from "@/components/ward-management/ward-derivations";
import { requiresAuthorisedDestination } from "@/components/ward-management/ward-eligibility";
import { recordedMovementMedicalClearance } from "@/components/ward-management/ward-medical-clearance";
import type { Movement, Referral } from "@/components/ward-management/ward-model";

export type AdmissionChecklistState = "done" | "outstanding" | "not_wired";

export type AdmissionChecklistItem = {
  key: "medical_clearance" | "legal_form" | "transport" | "contraband_search" | "medication_chart";
  label: string;
  state: AdmissionChecklistState;
  detail: string;
};

export const NOT_WIRED = "Not wired in this prototype.";

export function admissionChecklist(movement: Movement, referrals: readonly Referral[]): AdmissionChecklistItem[] {
  const clearance = recordedMovementMedicalClearance(movement, referrals);
  const transportNeed = transportNeedState(movement);
  const transportBooked = movement.transport !== undefined && movement.transport.cancelledAt === undefined;
  // No form on the record is settled only when the legal status needs none.
  const formNeeded = movement.legalForm === undefined && requiresAuthorisedDestination(movement.legalStatus);
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
    { key: "contraband_search", label: "Contraband search", state: "not_wired", detail: NOT_WIRED },
    { key: "medication_chart", label: "Medication chart", state: "not_wired", detail: NOT_WIRED },
  ];
}
