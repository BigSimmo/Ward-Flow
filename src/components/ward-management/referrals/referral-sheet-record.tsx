"use client";

// RQ9 (Josh, 3 Nov 2026): the Referral sheet for one referral id, read from the ward flow store.
// Loaded only when something opens it (`ReferralSheetHost`), so no page pays for it up front.

import { useMemo } from "react";

import { useWardClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { recordedMovementMedicalClearance } from "@/components/ward-management/ward-medical-clearance";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";

import { demographicLabel } from "./referral-board-model";
import type { IsbarRecorded } from "./referral-board-sheets";
import type { ReferralSheetTab } from "./referral-sheet-bus";
import { ReferralSummarySheet } from "./referral-summary-sheet";

/** As the board's own: the linked journey's legal status and clearance, or the referral's own. */
function recordedFacts(
  referral: Referral,
  movements: readonly Movement[],
  referrals: readonly Referral[],
): IsbarRecorded {
  const linked = movements.find((movement) => movement.referralId === referral.id && !movement.closure);
  return {
    legalStatus: linked?.legalStatus,
    clearance: linked ? recordedMovementMedicalClearance(linked, referrals) : referral.medicalClearance,
  };
}

export default function ReferralSheetRecord({
  referralId,
  tab,
  onClose,
}: {
  referralId: string;
  tab?: ReferralSheetTab;
  onClose: () => void;
}) {
  const { referrals, movements, patients } = useWardFlowSelect("referrals", "movements", "patients");
  const now = useWardClock();
  const referral = referrals.find((candidate) => candidate.id === referralId);
  const person = useMemo(
    () => (referral ? resolveSubjectPatient(referral, { patients, referrals, movements }) : undefined),
    [referral, patients, referrals, movements],
  );
  // The desk's scoped store may not hold it (another service's referral): nothing opens.
  if (!referral || !person) return null;
  return (
    <ReferralSummarySheet
      key={`${referral.id}-${tab ?? "summary"}`}
      open
      onClose={onClose}
      referral={referral}
      name={person.formalName}
      umrn={person.umrn}
      demographics={demographicLabel(referral)}
      now={now}
      recorded={recordedFacts(referral, movements, referrals)}
      initialTab={tab}
    />
  );
}
