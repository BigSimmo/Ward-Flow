"use client";

// Owner, 26 Sept 2026: screens name the patient, never the WF journey number. This hook resolves a
// movement (or any clinical subject) to its linked patient through `resolveSubjectPatient`, reading
// whatever the provider holds. Outside a provider, or with a partial test context, nothing is
// linked, so it answers the resolver's own "Unknown Patient": conservative, never an id.
//
// Not for ward-facing (`ward/`) screens: they must not read referral data (the referral-screen
// boundary guard), so they use the provider's `resolvePatientIdentity` instead. Neither applies any
// ward scoping to identity; whether a screen may show a name at all is that screen's decision.
import { useContext } from "react";

import { WardFlowContext } from "@/components/ward-management/ward-flow-provider";
import { resolveSubjectPatient, type ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";

type Subject = Parameters<typeof resolveSubjectPatient>[0];

/** Accepts any subject `resolveSubjectPatient` accepts, or a bare `{ movementId }` reference (an
 *  audit or reminder entry that holds only the id); the resolver looks that movement up itself. */
export function usePatientOf(): (subject: Subject | { movementId: string }) => ResolvedPatientInfo {
  const context = useContext(WardFlowContext);
  const state = {
    patients: context?.patients ?? [],
    referrals: context?.referrals ?? [],
    movements: context?.movements ?? [],
    // A stay converted from an initials-only booking is named through that booking.
    plannedAdmissions: context?.plannedAdmissions ?? [],
  };
  return (subject) => resolveSubjectPatient(subject as Subject, state);
}
