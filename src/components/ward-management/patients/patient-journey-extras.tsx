"use client";

/*
 * Beside the journey timeline on the patient page: "Where the hours went" for the movement, and
 * the ED-to-ward handover pack once a ward has accepted it. Loaded on its own (patient-now-panel)
 * so the phone's first load does not grow. Everything is read from the record through pure
 * selectors; this file only gathers their inputs.
 */

import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { admissionChecklist } from "@/components/ward-management/ward-admission-checklist";
import { calendarDateOf, type Instant } from "@/components/ward-management/ward-clock";
import { recordedMovementMedicalClearance } from "@/components/ward-management/ward-medical-clearance";
import { currentLegalDueAt } from "@/components/ward-management/legal-forms/legal-form-progression";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { originName } from "@/components/ward-management/ward-movement-origin";
import { patientAgeYears, type Patient } from "@/components/ward-management/ward-patients";
import { callRows, type CallTarget } from "./patient-call-list";
import { recordExtrasFor } from "./patient-record-extras";
import { handoverPackAvailable, type HandoverContact, type HandoverPackInput } from "./patient-handover-pack";
import { PatientHandoverPackButton } from "./patient-handover-pack-button";
import { PatientHoursBreakdown } from "./patient-hours-breakdown";

function ageSexWords(patient: Patient | undefined, dayZero: Date, now: Instant): string {
  if (!patient) return "";
  const years = patient.dateOfBirth ? patientAgeYears(patient, calendarDateOf(now, dayZero)) : Number.NaN;
  const age = Number.isFinite(years) && years >= 0 ? `${years}` : "age not recorded";
  return `${age}, ${patient.sex?.trim() ? patient.sex.toLowerCase() : "sex not recorded"}`;
}

export function PatientJourneyExtras({
  movement,
  patient,
  patientName,
  acceptingUnit,
  callTargets,
  riskFlags,
  now,
}: {
  movement: Movement;
  patient: Patient | undefined;
  /** The name as the page's header shows it. */
  patientName: string;
  acceptingUnit: Unit | undefined;
  callTargets: readonly CallTarget[];
  riskFlags: HandoverPackInput["riskFlags"];
  now: Instant;
}) {
  const { referrals, dayZero } = useWardFlowSelect("referrals", "dayZero");
  let pack: HandoverPackInput | undefined;
  if (handoverPackAvailable(movement)) {
    const edContacts: HandoverContact[] = callRows(
      callTargets.filter((target) => target.kind === "ed"),
      now,
    ).map((row) => ({ name: row.name, role: row.role, number: row.number }));
    const community = recordExtrasFor(patient?.id)?.community?.find((episode) => episode.status === "active");
    const careContacts: HandoverContact[] = community
      ? [
          {
            name: community.caseManager.name,
            role: `Care coordinator, ${community.team}`,
            number: community.caseManager.phone ?? null,
          },
          ...(community.psychiatrist
            ? [
                {
                  name: community.psychiatrist.name,
                  role: community.psychiatrist.role || "Psychiatrist",
                  number: community.psychiatrist.phone ?? null,
                },
              ]
            : []),
        ]
      : [];
    pack = {
      movement,
      patient: { name: patientName, umrn: patient?.umrn ?? "", ageSex: ageSexWords(patient, dayZero, now) },
      fromName: originName(movement),
      wardName: acceptingUnit?.name,
      riskFlags,
      clearance: recordedMovementMedicalClearance(movement, referrals),
      paperExpiryAt: currentLegalDueAt(movement),
      edContacts,
      careContacts,
      checklist: admissionChecklist(movement, referrals),
      now,
    };
  }
  return (
    <>
      <PatientHoursBreakdown movement={movement} now={now} />
      {pack ? <PatientHandoverPackButton input={pack} /> : null}
    </>
  );
}
