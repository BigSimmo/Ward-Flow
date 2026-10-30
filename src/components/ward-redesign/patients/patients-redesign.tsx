"use client";

import { PatientSearchPage } from "./patient-search";

/**
 * Patients, redesigned. The review kept almost all of this page (the search with date of birth,
 * the stage chips, highlights and This shift), so it draws a copy of today's screen
 * (`patient-search.tsx`, `patient-census-view.tsx`, `census.module.css`) with the fixes made in the
 * copied stylesheet: table cells wrap instead of ending in "…", and the highlight chips wrap
 * instead of running off the card's edge.
 */
export function PatientsRedesign() {
  return <PatientSearchPage />;
}
