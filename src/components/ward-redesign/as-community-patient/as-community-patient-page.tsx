"use client";

import { PatientPage } from "@/components/ward-redesign/patient/patient-page";

/**
 * As community clinician: the Patient record mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open.
 */
export function AsCommunityPatientPage() {
  return <PatientPage />;
}
