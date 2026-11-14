import type { Admission, PlannedAdmission } from "@/components/ward-management/ward-admissions";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { currentLegalPosition } from "@/components/ward-management/ward-legal-form-progression";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import type { Patient } from "@/components/ward-management/ward-patients";
import { classifyLegalStatus, legalStatusIsOnOrder } from "@/components/ward-management/ward-legal-status";
import { isNotVoluntary } from "@/components/ward-management/ward-legal-meaning";

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

/**
 * WHETHER THE STAY AND THE PATIENT RECORD HOLD DIFFERENT LEGAL STATUSES (D-187 item 1, Q19; mechanics
 * and clock audit M13a, D-210 (Josh, 14 Nov 2026), ruling 5). The patient page's rule: both are kept,
 * the stay's status is the one shown, and one side recorded with the other not is a difference too.
 * The patient page and the TV wall read this, so the "statuses differ" mark appears on both or neither.
 */
export function legalStatusesDiffer(
  movement: Pick<Movement, "legalStatus"> | undefined,
  patient: Pick<Patient, "legalStatus"> | undefined,
): boolean {
  return movement !== undefined && patient !== undefined && movement.legalStatus !== patient.legalStatus;
}

/** The patient page's words for the mark. */
export const LEGAL_STATUSES_DIFFER = "These two legal statuses differ. Check which is current.";

/**
 * The sentence beside a recorded legal mismatch (`movement.legalMismatch`, FLAG_LEGAL_MISMATCH) at
 * the step that moves the person: the ED board, the patient page and Handover. A warning only, never
 * a block (D-16: recorded, never overridden). Wording approved by Josh, 14 Nov 2026 (R-LEGAL-4).
 */
export const LEGAL_MISMATCH_WARNING = "Legal status does not match this ward. Check before moving.";

/**
 * R-LEGAL-4 (Josh, 14 Nov 2026): the short chip for the same flag on lists (Search, Movements, the
 * Capacity ward drawer), with the sentence as its title. One pattern: chip on lists, sentence at
 * the moving step. Amber, display only.
 */
export const LEGAL_MISMATCH_CHIP = "Legal mismatch";

/** The open journeys accepted for one ward whose recorded legal mismatch still stands (R-LEGAL-4). */
export function currentLegalMismatchesFor(movements: readonly Movement[], unitId: string): Movement[] {
  return movements.filter((movement) => movement.acceptedUnitId === unitId && hasCurrentLegalMismatch(movement));
}

/**
 * Whether a recorded legal mismatch still describes this journey: it names the ward that accepted
 * the person, the journey is open, and the recorded status is still the kind the flag named. A flag
 * for a ward the journey has moved on from, or a status since changed, shows nothing. Read only;
 * the stored flag is never changed here.
 */
export function hasCurrentLegalMismatch(
  movement: Pick<Movement, "legalMismatch" | "acceptedUnitId" | "legalStatus" | "closure"> | undefined,
): boolean {
  const flag = movement?.legalMismatch;
  if (!movement || !flag || movement.closure || flag.unitId !== movement.acceptedUnitId) return false;
  return flag.kind === "voluntary_on_locked_ward"
    ? movement.legalStatus === "Voluntary"
    : isNotVoluntary(movement.legalStatus);
}

/** Whether the stay's own journey and its patient record differ, read as the patient page reads them. */
export function stayLegalStatusesDiffer(admission: Admission, source: StayLegalSource): boolean {
  return legalStatusesDiffer(stayMovement(admission, source), resolveSubjectPatient(admission, source).patient);
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
  // Audit H4 (14 Nov 2026): the one current legal position. A form a person recorded as ended is not
  // named as the person's authority; the recorded status says where they stand.
  const position = currentLegalPosition(stayMovement(admission, source));
  const code = position.ended ? undefined : position.form?.code;
  // H-0842: the form reads with its register title, never the bare code.
  if (code) return legalFormName({ code });
  if (kind === "cto") return "CTO";
  if (kind === "referred") return "Referred for exam";
  if (kind === "detained")
    return /^detained awaiting examination$/i.test(status.trim()) ? "Awaiting exam" : "Involuntary";
  return "Status unrecognised";
}
