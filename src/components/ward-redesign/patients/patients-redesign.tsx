"use client";

import { PatientSearchPage } from "@/components/ward-management/search/patient-search";

import styles from "./patients-redesign.module.css";

/**
 * Patients, redesigned. The review kept almost all of this page (the search with date of birth,
 * the stage chips, highlights and This shift), so it draws today's screen and applies the two
 * fixes with one scoped stylesheet: table cells wrap instead of ending in "…", and on a tablet each
 * row restacks into two lines.
 */
export function PatientsRedesign() {
  return (
    <div className={styles.patients}>
      <PatientSearchPage />
    </div>
  );
}
