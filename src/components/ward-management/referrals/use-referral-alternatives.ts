"use client";

import { useState } from "react";
import {
  orderedAlternatives,
  type AdmissionAlternativeOption,
  type AdmissionAlternativeOutcome,
  type AlternativeConsidered,
} from "./referral-alternatives";

type Marks = Partial<Record<AdmissionAlternativeOption, AdmissionAlternativeOutcome>>;

/**
 * Feature 26: the referral sheet's alternatives-to-admission marks. Kept out of the drawer state
 * file so that file stays inside its size cap. `applies` is true for an ED or community sender
 * asking for a ward bed; otherwise nothing is sent, even if something was marked earlier.
 * Optional throughout: no mark ever blocks Send.
 */
export function useReferralAlternatives(applies: boolean) {
  const [marks, setMarks] = useState<Marks>({});
  const list: AlternativeConsidered[] = orderedAlternatives(marks);
  const setMark = (option: AdmissionAlternativeOption, outcome: AdmissionAlternativeOutcome | undefined) =>
    setMarks((current) => {
      const next = { ...current };
      if (outcome === undefined) delete next[option];
      else next[option] = outcome;
      return next;
    });
  return {
    applies,
    marks,
    list,
    setMark,
    /** Spread into `RECEIVE_REFERRAL`: absent when nothing applies or nothing is marked. */
    eventField: applies && list.length > 0 ? { alternativesConsidered: list } : {},
  };
}

export type ReferralAlternativesState = ReturnType<typeof useReferralAlternatives>;
