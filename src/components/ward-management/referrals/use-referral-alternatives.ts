"use client";

import { useState } from "react";
import {
  orderedAlternatives,
  type AdmissionAlternativeOption,
  type AdmissionAlternativeOutcome,
  type AlternativeConsidered,
  type AlternativeMarks,
} from "./referral-alternatives";

/**
 * Feature 26: the referral sheet's alternatives-to-admission marks. Kept out of the drawer state
 * file so that file stays inside its size cap. `applies` is true for an ED or community sender
 * asking for a ward bed; otherwise nothing is sent, even if something was marked earlier.
 * Optional throughout: no mark ever blocks Send.
 *
 * Marks belong to the person they were made for: choosing another person in the sheet starts
 * again with none, so one person's answers can never be sent on another's referral. A kept draft
 * brings its marks back, and they are part of the draft, so marking counts as an unsaved change.
 */
export function useReferralAlternatives(
  applies: boolean,
  patientKey: string,
  kept: { activePatientKey: string; alternatives?: AlternativeMarks } | null | undefined,
) {
  const [held, setHeld] = useState(() => ({
    patientKey: kept?.activePatientKey ?? patientKey,
    marks: kept?.alternatives ?? ({} as AlternativeMarks),
  }));
  const marks: AlternativeMarks = held.patientKey === patientKey ? held.marks : {};
  const list: AlternativeConsidered[] = orderedAlternatives(marks);
  const setMark = (option: AdmissionAlternativeOption, outcome: AdmissionAlternativeOutcome | undefined) =>
    setHeld((current) => {
      const next = { ...(current.patientKey === patientKey ? current.marks : {}) };
      if (outcome === undefined) delete next[option];
      else next[option] = outcome;
      return { patientKey, marks: next };
    });
  return {
    applies,
    marks,
    list,
    setMark,
    /** Spread into `RECEIVE_REFERRAL`: absent when nothing applies or nothing is marked. */
    eventField: applies && list.length > 0 ? { alternativesConsidered: list } : {},
    /** Spread into the kept draft: absent when nothing is marked. */
    draftField: list.length > 0 ? { alternatives: marks } : {},
  };
}

export type ReferralAlternativesState = ReturnType<typeof useReferralAlternatives>;
