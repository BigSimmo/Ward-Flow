import type { Admission, PlannedAdmission } from "@/components/ward-management/ward-admissions";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import type { Patient } from "@/components/ward-management/ward-patients";
import { classifyLegalStatus, legalStatusIsOnOrder } from "@/components/ward-management/ward-legal-status";

/**
 * A STAY'S LEGAL STATUS, READ ONE WAY (audit A3-1/A3-18, 13 Oct 2026). The movement that brought
 * the person is the record of the form and status; the patient record is the fallback. Used by the
 * absence task, the out-of-area cards and the return sheet, so they never disagree.
 */
export type StayLegalSource = {
  movements?: readonly Movement[];
  patients?: readonly Patient[];
  referrals?: readonly Referral[];
  plannedAdmissions?: readonly PlannedAdmission[];
};

/**
 * The movement that brought the stay. A stay can be linked either way: `admission.movementId`, or
 * only `movement.admissionId` (seeded stays and converted bookings keep `movementId: null`). Reading
 * one link alone missed an absent patient on an order (fresh audit S-1, 26 Oct 2026).
 */
function stayMovement(admission: Admission, source: StayLegalSource): Movement | undefined {
  if (admission.movementId) return source.movements?.find((candidate) => candidate.id === admission.movementId);
  return source.movements?.find((candidate) => candidate.admissionId === admission.id);
}

/** The recorded legal status for a stay: the movement that brought them, the converted booking, then the record. */
export function stayLegalStatus(admission: Admission, source: StayLegalSource): string | undefined {
  const movement = stayMovement(admission, source);
  if (movement?.legalStatus) return movement.legalStatus;
  const planned =
    admission.plannedLegalStatus ??
    source.plannedAdmissions?.find((booking) => booking.state === "arrived" && booking.admissionId === admission.id)
      ?.legalStatus;
  if (planned) return planned;
  return resolveSubjectPatient(admission, source).patient?.legalStatus;
}

/** On an order: a recorded status that is not voluntary (`legalStatusIsOnOrder`). Not recorded is not assumed either way. */
export function isOnOrder(status: string | undefined): boolean {
  return legalStatusIsOnOrder(status);
}

/**
 * The short legal word for a stay's second line: "Form 6A" with its register title when a form is recorded and the person
 * is on an order, else the recorded status in its shortest words, or undefined when nothing is
 * recorded. The word comes from `classifyLegalStatus`, not from `isOnOrder`: that yes/no is
 * fail-safe for the absence steps and would call a CTO, a referral or "Not recorded"
 * "Involuntary" (production audit 24 Oct 2026, EDR-02). A recorded status only; nothing is computed.
 */
export function stayLegalShort(admission: Admission, source: StayLegalSource): string | undefined {
  const status = stayLegalStatus(admission, source);
  const kind = classifyLegalStatus(status);
  if (status === undefined || kind === "not_recorded") return undefined;
  if (kind === "voluntary") return "Voluntary";
  const code = stayMovement(admission, source)?.legalForm?.code;
  // H-0842: the form reads with its register title, never the bare code.
  if (code) return legalFormName({ code });
  if (kind === "cto") return "CTO";
  if (kind === "referred") return "Referred for exam";
  if (kind === "detained")
    return /^detained awaiting examination$/i.test(status.trim()) ? "Awaiting exam" : "Involuntary";
  return "Status unrecognised";
}
