import { useState } from "react";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { KeptDraft } from "./ward-referral-drawer-model";
import { carriedCommunityNeeds, referralCarryForKey, type ReferralCarryOver } from "./referral-carry-over";

/**
 * Feature 39 (9 Nov 2026): the referral form's carried facts. `start` is what the form's fields
 * open with: a kept draft as it stands, else the facts carried from the person's current stay or
 * last referral. `carryFor` reads them again when another person is picked, and keeps them for the
 * notes (`carriedNotesFor`). Free text and risk flags are never among them.
 */
export function useReferralCarryOver(kept: KeptDraft | null, initialPatientKey: string) {
  const { admissions, movements, patients, referrals, units, dayZero } = useWardFlowSelect(
    "admissions",
    "movements",
    "patients",
    "referrals",
    "units",
    "dayZero",
  );
  const now = useWardFlowClock();
  const read = (key: string, ageBandKnown: boolean) =>
    referralCarryForKey(key, { admissions, movements, patients, referrals, units, dayZero }, now, ageBandKnown);
  const [carry, setCarry] = useState<ReferralCarryOver>(() => (kept ? {} : read(initialPatientKey, false)));
  const start: Partial<KeptDraft> = kept ?? startOf(carry);
  /** Reads the carried facts for a newly picked person, keeps them, and returns what fields open with. */
  function carryFor(key: string, ageBandKnown: boolean): Partial<KeptDraft> {
    const next = read(key, ageBandKnown);
    setCarry(next);
    return startOf(next);
  }
  return { carry, start, carryFor };
}

/** The draft fields a carry-over fills, and only those. */
function startOf(carry: ReferralCarryOver): Partial<KeptDraft> {
  return {
    ...(carry.ageBand ? { ageBand: carry.ageBand.value } : {}),
    ...(carry.highAcuity ? { highAcuity: carry.highAcuity.value } : {}),
    ...(carry.legalStatus ? { legalStatus: carry.legalStatus.value } : {}),
    ...(carry.security ? { security: carry.security.value } : {}),
    communityNeeds: carriedCommunityNeeds(carry),
  };
}
