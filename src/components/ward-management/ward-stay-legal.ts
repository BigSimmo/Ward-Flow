import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import type { Patient } from "@/components/ward-management/ward-patients";
import { legalStatusIsOnOrder } from "@/components/ward-management/ward-legal-status";

/**
 * A STAY'S LEGAL STATUS, READ ONE WAY (audit A3-1/A3-18, 13 Oct 2026). The movement that brought
 * the person is the record of the form and status; the patient record is the fallback. Used by the
 * absence task, the out-of-area cards and the return sheet, so they never disagree.
 */
export type StayLegalSource = {
  movements?: readonly Movement[];
  patients?: readonly Patient[];
  referrals?: readonly Referral[];
};

function stayMovement(admission: Admission, source: StayLegalSource): Movement | undefined {
  return admission.movementId
    ? source.movements?.find((candidate) => candidate.id === admission.movementId)
    : undefined;
}

/** The recorded legal status for a stay: the movement that brought them, then the record. */
export function stayLegalStatus(admission: Admission, source: StayLegalSource): string | undefined {
  const movement = stayMovement(admission, source);
  if (movement?.legalStatus) return movement.legalStatus;
  return resolveSubjectPatient(admission, source).patient?.legalStatus;
}

/** On an order: a recorded status that is not voluntary (`legalStatusIsOnOrder`). Not recorded is not assumed either way. */
export function isOnOrder(status: string | undefined): boolean {
  return legalStatusIsOnOrder(status);
}

/**
 * The short legal word for a stay's second line: "Form 6A" when a form is recorded and the person
 * is on an order, else "Voluntary", "Involuntary" or undefined when nothing is recorded.
 */
export function stayLegalShort(admission: Admission, source: StayLegalSource): string | undefined {
  const status = stayLegalStatus(admission, source);
  if (status === undefined || status.trim() === "") return undefined;
  if (!isOnOrder(status)) return "Voluntary";
  const code = stayMovement(admission, source)?.legalForm?.code;
  return code ? `Form ${code}` : "Involuntary";
}
