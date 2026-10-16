"use client";

// Owner, 26 Sept 2026: screens name the patient, never the WF journey number. This hook resolves a
// movement (or any clinical subject) to its linked patient through `resolveSubjectPatient`, reading
// whatever the provider holds. Outside a provider, or with a partial test context, nothing is
// linked, so it answers the resolver's own "Name not recorded": conservative, never an id.
//
// Not for ward-facing (`ward/`) screens: they must not read referral data (the referral-screen
// boundary guard), so they use the provider's `resolvePatientIdentity` instead. Neither applies any
// ward scoping to identity; whether a screen may show a name at all is that screen's decision.
import { useCallback, useMemo } from "react";

import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import {
  resolveSubjectPatient,
  withUmrnInPlaceOfMovementIds,
  type PatientLookup,
  type ResolvedPatientInfo,
} from "@/components/ward-management/ward-patient-resolver";

type Subject = Parameters<typeof resolveSubjectPatient>[0];

/** Accepts any subject `resolveSubjectPatient` accepts, or a bare `{ movementId }` reference (an
 *  audit or reminder entry that holds only the id); the resolver looks that movement up itself. */
export function usePatientOf(): (subject: Subject | { movementId: string }) => ResolvedPatientInfo {
  const state = useProviderLookup();
  // Stable while the provider's records are, so a memo that lists the resolver does not recompute on every render.
  return useCallback((subject) => resolveSubjectPatient(subject as Subject, state), [state]);
}

/** D-39: engine prose (a refusal, a notice, an exception line) with each quoted WF journey number
 *  swapped for that patient's UMRN. Same context reading and ward boundary as `usePatientOf`. */
export function useUmrnText(): (text: string) => string {
  const state = useProviderLookup();
  return (text) => withUmrnInPlaceOfMovementIds(text, state);
}

const NONE: readonly never[] = [];

/** The provider's records as one stable object, so the resolver's index cache survives re-renders. */
function useProviderLookup(): PatientLookup {
  const context = useOptionalWardFlowSelect("patients", "referrals", "movements", "plannedAdmissions");
  const patients = context?.patients ?? NONE;
  const referrals = context?.referrals ?? NONE;
  const movements = context?.movements ?? NONE;
  const plannedAdmissions = context?.plannedAdmissions ?? NONE;
  return useMemo(
    () => ({ patients, referrals, movements, plannedAdmissions }),
    [patients, referrals, movements, plannedAdmissions],
  );
}
