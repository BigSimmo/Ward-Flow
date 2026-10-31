"use client";

import styles from "@/components/ward-redesign/patient/patient-redesign.module.css";
import { PatientRedesign } from "./patient-redesign";

/**
 * Role view (community clinician): the sample record the coordinator's mock-up draws (PT-023) is on
 * the Peel team's caseload, so this desk could not open it. This view draws Emberfall, Cassia
 * (PT-093), whose referral the Midland team accepted before her admission to SJGM Adult Open: a
 * person the team follows into hospital, in full.
 */
const MIDLAND_PATIENT_ID = "PT-093";

/**
 * As community clinician: the Patient record mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open.
 */
export function AsCommunityPatientPage() {
  return (
    <div className={styles.scope}>
      <PatientRedesign patientId={MIDLAND_PATIENT_ID} />
    </div>
  );
}
