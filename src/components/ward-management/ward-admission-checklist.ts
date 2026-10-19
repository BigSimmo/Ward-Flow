/**
 * Admission arrival checklist (Top 25 item 14).
 *
 * Lists what the receiving ward wants settled before a patient arrives, read from the recorded
 * medical clearance, legal form receipt, transport need, contraband search and medication chart.
 * Checks without a recorded value remain explicitly not wired; this view never records a completion.
 * Nothing here blocks the handover: the reducer's own `HANDOVER_READY` rules are unchanged.
 */
import { transportNeedState } from "@/components/ward-management/ward-derivations";
import { requiresAuthorisedDestination } from "@/components/ward-management/ward-eligibility";
import { recordedMovementMedicalClearance } from "@/components/ward-management/ward-medical-clearance";
import type { Movement, Referral } from "@/components/ward-management/ward-model";

type AdmissionChecklistState = "done" | "outstanding" | "not_wired";

export type AdmissionChecklistItem = {
  key: "medical_clearance" | "legal_form" | "transport" | "contraband_search" | "medication_chart";
  label: string;
  state: AdmissionChecklistState;
  detail: string;
};

/** @deprecated Local drafts cannot establish recorded checklist completion. */
export type AdmissionChecklistOverrides = {
  contraband_search?: boolean;
  medication_chart?: boolean;
};

export const NOT_WIRED = "Not wired in this prototype.";

export function admissionChecklist(
  movement: Movement,
  referrals: readonly Referral[],
  /** @deprecated Ignored: only recorded movement values establish completion. */
  _overrides?: AdmissionChecklistOverrides,
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
    {
      key: "contraband_search",
      label: "Contraband search",
      state: contrabandDone === undefined ? "not_wired" : contrabandDone ? "done" : "outstanding",
      detail: contrabandDone === undefined ? NOT_WIRED : contrabandDone ? "Checked in ED" : "Not yet checked",
    },
    {
      key: "medication_chart",
      label: "Medication chart",
      state: medChartDone === undefined ? "not_wired" : medChartDone ? "done" : "outstanding",
      detail: medChartDone === undefined ? NOT_WIRED : medChartDone ? "Ready for ward" : "Not yet ready",
    },
  ];
}
