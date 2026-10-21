import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Movement } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { arrivalGaps } from "@/components/ward-management/ward-transport-checks";
import type { FeedMessage } from "./hospital-feed";

/**
 * THE SYNTHETIC HOSPITAL FEED (fix plan item 5, 21 Oct 2026): invented admission, transfer and
 * discharge messages built from the demo's own records, so a demo shift can show messages arriving
 * and a person confirming each one. Nothing here is connected to a hospital system, and nothing
 * here changes the record: `feedSuggestion` only says which normal event a person could confirm.
 *
 * The messages include one record number that is not synthetic and one message sent twice, so the
 * inbox shows both refusals. Matching is by record number only (`hospital-feed.ts`).
 */

type FeedSources = {
  movements: readonly Movement[];
  admissions: readonly Admission[];
  patients: readonly Patient[];
};

/** An invented record number held by nobody, for the emergency registration message. */
const UNKNOWN_SYNTHETIC_UMRN = "UM999901";

function hl7(controlId: string, event: string, umrn: string, patient: Patient | undefined, place: string, cls: string) {
  const name = patient ? `${patient.familyName.toUpperCase()}^${patient.givenName.toUpperCase()}` : "UNKNOWN^PERSON";
  const dob = patient ? patient.dateOfBirth.replaceAll("-", "") : "";
  return [
    `MSH|^~\\&|SIMPAS|SIMHOSP|WARDFLOW|NET|||ADT^${event}|${controlId}|P|2.4`,
    `EVN|${event}|`,
    `PID|1||${umrn}^^^SIMHOSP^MR||${name}||${dob}|`,
    `PV1|1|${cls}|${place}^^||||`,
  ].join("\r");
}

/** An open movement a feed admission would match: in transit or ready to hand over, with no gap. */
function arrivingMovement(movement: Movement): boolean {
  return (
    !movement.closure &&
    (movement.stage === "moving" || movement.stage === "handover_ready") &&
    !!movement.acceptedUnitId &&
    arrivalGaps(movement).length === 0
  );
}

function inBed(admission: Admission): boolean {
  return (
    admission.state === "occupied" &&
    admission.leftAt === null &&
    admission.arrivedAt !== null &&
    admission.awayAtEmergencyDepartmentSince === null
  );
}

/**
 * The simulated messages, in the order they arrive: up to three admissions for people on their way
 * to a bed, an emergency registration for a person not on file, a message with a real-looking record
 * number (refused), up to two discharges, and the first message again (refused as a duplicate).
 */
export function simulatedFeedMessages({ movements, admissions, patients }: FeedSources): readonly string[] {
  const byId = new Map(patients.map((patient) => [patient.id, patient]));
  // PV1-3 carries the ward id as the point of care. The inbox names the ward from the record instead.
  const placeCode = (id: string | undefined) => (id ?? "").toUpperCase();
  let sequence = 0;
  const nextId = () => `SIM${String(++sequence).padStart(4, "0")}`;
  const arrivals = movements
    .filter(arrivingMovement)
    .flatMap((movement) => {
      const patient = movement.patientId ? byId.get(movement.patientId) : undefined;
      return patient ? [{ patient, place: placeCode(movement.acceptedUnitId) }] : [];
    })
    .slice(0, 3)
    .map(({ patient, place }) => hl7(nextId(), "A01", patient.umrn, patient, place, "I"));
  const departures = admissions
    .filter(inBed)
    .flatMap((admission) => {
      const patient = admission.patientId ? byId.get(admission.patientId) : undefined;
      return patient ? [{ patient, place: placeCode(admission.unitId) }] : [];
    })
    .slice(0, 2)
    .map(({ patient, place }) => hl7(nextId(), "A03", patient.umrn, patient, place, "I"));
  const registration = hl7(nextId(), "A04", UNKNOWN_SYNTHETIC_UMRN, undefined, "ED", "E");
  const notSynthetic = hl7(nextId(), "A01", "MRN1234567", undefined, "", "I");
  return [...arrivals, registration, notSynthetic, ...departures, ...(arrivals[0] ? [arrivals[0]] : [])];
}

export type FeedSuggestion =
  | { kind: "arrival"; movementId: string; unitId: string; patientId: Patient["id"] }
  | { kind: "departure"; admissionId: string; unitId: string; patientId: Patient["id"] }
  | { kind: "none"; reason: string };

/**
 * The normal event a person could confirm for a read message, matched by record number only. An
 * admission confirms the arrival of an open movement; a discharge records the leaving of a stay
 * still in a bed. Everything else is for checking only and confirms nothing.
 */
export function feedSuggestion(message: FeedMessage, { movements, admissions, patients }: FeedSources): FeedSuggestion {
  const patient = patients.find((candidate) => candidate.umrn === message.umrn);
  if (!patient) return { kind: "none", reason: `No person holds ${message.umrn}. Nothing to confirm.` };
  if (message.event === "admitted") {
    const movement = movements.find((candidate) => candidate.patientId === patient.id && arrivingMovement(candidate));
    return movement?.acceptedUnitId
      ? { kind: "arrival", movementId: movement.id, unitId: movement.acceptedUnitId, patientId: patient.id }
      : { kind: "none", reason: "No movement for this person is on its way to a bed. Nothing to confirm." };
  }
  if (message.event === "discharged") {
    const admission = admissions.find((candidate) => candidate.patientId === patient.id && inBed(candidate));
    return admission
      ? { kind: "departure", admissionId: admission.id, unitId: admission.unitId, patientId: patient.id }
      : { kind: "none", reason: "This person is not in a bed on any ward. Nothing to confirm." };
  }
  return {
    kind: "none",
    reason:
      message.event === "transferred"
        ? "Transfers are for checking only. Check the person's ward and bed."
        : "Registrations are for checking only. Nothing to confirm.",
  };
}
