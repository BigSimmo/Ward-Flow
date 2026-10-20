/**
 * "WHAT WE STILL NEED" (smart features idea 4, 19 Oct 2026): what a ward can ask for before it
 * decides on a referral, instead of declining or ringing. A closed list, chosen and never typed, so
 * no clinical detail or typed text reaches the record (D-18). The wording is Josh's to change; this
 * is the list proposed in the ideas document.
 *
 * Asking does not decide anything and does not stop the ward's decision clock.
 */
export const REFERRAL_INFORMATION_NEEDS = [
  { id: "medical_clearance_result", label: "Medical clearance result" },
  { id: "legal_form_copy", label: "Legal form copy" },
  { id: "bloods_or_ecg", label: "Recent bloods or ECG" },
  { id: "collateral_history", label: "Collateral history" },
  { id: "drug_screen", label: "Drug screen" },
  { id: "bed_type_clarified", label: "Bed type clarified" },
] as const;

export type ReferralInformationNeed = (typeof REFERRAL_INFORMATION_NEEDS)[number]["id"];

/** Runtime id list for the reducer's membership check. */
export const REFERRAL_INFORMATION_NEED_IDS: readonly ReferralInformationNeed[] = REFERRAL_INFORMATION_NEEDS.map(
  (entry) => entry.id,
);

export function referralInformationNeedLabel(need: ReferralInformationNeed): string {
  return REFERRAL_INFORMATION_NEEDS.find((entry) => entry.id === need)?.label ?? "Item not recorded";
}

/** The needs still waiting on the referrer, in the order the ward asked for them. */
export function openInformationNeeds<T extends { need: ReferralInformationNeed; metAt?: number }>(
  needs: readonly T[] | undefined,
): T[] {
  return (needs ?? []).filter((entry) => entry.metAt === undefined);
}
