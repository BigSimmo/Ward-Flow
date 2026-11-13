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

/**
 * F-41 (A9-32): the needs the referrer has marked provided, newest first, so the ward sees "provided"
 * and when, not an item that silently leaves its list. A need asked again and still waiting is
 * listed only as waiting.
 */
export function providedInformationNeeds<T extends { need: ReferralInformationNeed; metAt?: number }>(
  needs: readonly T[] | undefined,
): (T & { metAt: number })[] {
  const waitingAgain = new Set(openInformationNeeds(needs).map((entry) => entry.need));
  return (needs ?? [])
    .filter((entry): entry is T & { metAt: number } => entry.metAt !== undefined && !waitingAgain.has(entry.need))
    .sort((a, b) => b.metAt - a.metAt);
}

/**
 * F-41 (A9-32): what the sender's board row says when a ward is waiting on them: "Ward asked for 2
 * items", counting the open asks on every ward arm still waiting for an answer (the same arms the
 * sender's tick-off panel lists). Undefined when nothing is waiting.
 */
export function wardAskedWords(referral: {
  destinations: readonly {
    state: string;
    withdrawnAt?: number;
    destination: { kind: string };
    informationNeeds?: readonly { need: ReferralInformationNeed; metAt?: number }[];
  }[];
}): string | undefined {
  const open = referral.destinations
    .filter(
      (arm) => arm.destination.kind === "psychiatric_ward" && arm.state === "queued" && arm.withdrawnAt === undefined,
    )
    .reduce((count, arm) => count + openInformationNeeds(arm.informationNeeds).length, 0);
  if (open === 0) return undefined;
  return `Ward asked for ${open} ${open === 1 ? "item" : "items"}`;
}
