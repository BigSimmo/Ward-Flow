"use client";

import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { WardMovementNotFound } from "@/components/ward-management/ward-movement-not-found";

/**
 * shell-6 (13 Oct 2026): `/people/UM100023` used to say a real UMRN "is not a person's record
 * number". Routes use the internal `PT-` id, but people share and type the UMRN, so this resolves it
 * against the live patient list (which holds people added this session, so it runs on the client).
 * No match says so plainly and offers the patient search with the UMRN filled in.
 */
export function PersonByUmrn({ umrn }: { umrn: string }) {
  const { patients } = useWardFlowSelect("patients");
  const wanted = umrn.toUpperCase();
  const patient = patients.find((candidate) => candidate.umrn.toUpperCase() === wanted);
  if (!patient) return <WardMovementNotFound requestedId={wanted} reason="no-such-umrn" />;
  return <PatientNowScreen patientId={patient.id} />;
}
