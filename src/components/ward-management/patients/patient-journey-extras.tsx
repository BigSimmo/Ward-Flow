"use client";

/*
 * The patient page's lazily loaded extras. On Now, in the "Hand over and print" card: the ED-to-ward
 * handover pack once a ward has accepted the movement, and the patient or carer page. On History:
 * "Where the hours went" (moved there in the 12 Nov 2026 redesign). Loaded on its own so the
 * phone's first load does not grow; both parts stay in this one file so they share one download.
 * Everything is read from the record through pure selectors; this file only gathers their inputs.
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
import { PatientCarerPageButton } from "../patient-carer-page";

function ageSexWords(patient: Patient | undefined, dayZero: Date, now: Instant): string {
  if (!patient) return "";
  const years = patient.dateOfBirth ? patientAgeYears(patient, calendarDateOf(now, dayZero)) : Number.NaN;
  const age = Number.isFinite(years) && years >= 0 ? `${years}` : "age not recorded";
  return `${age}, ${patient.sex?.trim() ? patient.sex.trim().toLowerCase() : "sex not recorded"}`;
}

/** "Where the hours went" for the History tab, from this file's own download. */
export function PatientJourneyHours({ movement, now }: { movement: Movement; now: Instant }) {
  return <PatientHoursBreakdown movement={movement} now={now} />;
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
  // The desk's own scoped support records, so a recorded advocacy notice reads as recorded in the
  // pack (CodeRabbit, #1609); a desk never sent a record still sees it as not recorded.
  const { referrals, dayZero, supportNotifications, units } = useWardFlowSelect(
    "referrals",
    "dayZero",
    "supportNotifications",
    "units",
  );
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
      checklist: admissionChecklist(movement, referrals, undefined, { patient, supportNotifications, now }),
      now,
    };
  }
  return (
    <>
      {pack ? <PatientHandoverPackButton input={pack} dayZero={dayZero} /> : null}
      <PatientCarerPageButton movement={movement} units={units} />
    </>
  );
}
