"use client";

/**
 * D-83 (Josh, 26 Oct 2026): names are shown in full everywhere, with no initials-only mode, so the
 * Discreet names on phone setting (A2-20) was removed (fresh audit W-9). Lists still call one
 * formatter, `nameFor(info.displayName, info.umrn)`, so any later name rule lands in one place.
 */
export const patientNameAsGiven = (name: string): string => name;

export function usePatientNameDisplay(): (name: string, umrn: string | undefined | null) => string {
  return patientNameAsGiven;
}
