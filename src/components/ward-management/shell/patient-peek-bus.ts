// Patient peek (Josh's approval, 8 Nov 2026): a panel that opens a person's movement over the
// current page instead of going to the Patient page, with the full page one link away.
const PATIENT_PEEK_EVENT = "ward-flow-open-patient-peek";

export type PatientPeekRequest = { movementId: string };

export function openPatientPeek(movementId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PatientPeekRequest>(PATIENT_PEEK_EVENT, { detail: { movementId } }));
}

export function onPatientPeek(listener: (request: PatientPeekRequest) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<PatientPeekRequest>).detail);
  window.addEventListener(PATIENT_PEEK_EVENT, handler);
  return () => window.removeEventListener(PATIENT_PEEK_EVENT, handler);
}
