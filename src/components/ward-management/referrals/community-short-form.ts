import {
  normaliseSuburbKey,
  parseFollowUpClinicSet,
  S2015_CATCHMENT_ROWS,
} from "@/components/ward-management/ward-catchment";
import type { CommunityReferralPurpose } from "@/components/ward-management/ward-model-referral-parts";
import { communityReferralPurposeLabel } from "@/components/ward-management/ward-referrals";
import { communityTeamKey } from "./referral-destination-options";
import { clearanceError, type DocumentationDraft } from "./referral-flow-panels";
import type { FIRST_CONTACT_TARGETS } from "./referral-submission";

/**
 * D-77 short community form (mock-up approved 21 Oct 2026): Patient, Referral and Team, with no
 * Documents step. The Referral step asks the purpose, the first contact time and one medical
 * clearance question (Josh, 23 Oct 2026). Triage, charts and extra documents are recorded as none.
 */

/** Josh, 23 Oct 2026: first contact sets the urgency tier. 24 hours is Tier 1, 72 hours Tier 2, 7 days Tier 3. */
const TIER_BY_FIRST_CONTACT: Record<(typeof FIRST_CONTACT_TARGETS)[number], string> = {
  "24 hours": "1",
  "72 hours": "2",
  "7 days": "3",
};

/** The urgency a community referral records, as the drawer holds it: "" until first contact is chosen. */
export function communityUrgency(firstContact: (typeof FIRST_CONTACT_TARGETS)[number] | undefined): string {
  return firstContact ? TIER_BY_FIRST_CONTACT[firstContact] : "";
}

/** The Referral step's own checks beyond source and first contact: the purpose, then clearance. */
export function communityReferralError(purpose: CommunityReferralPurpose | "", draft: DocumentationDraft) {
  return purpose ? clearanceError(draft) : "Choose what the community referral is for.";
}

/** Clearance answers still needed, counted the way `clearanceError` checks them. */
export function clearanceNeeded(draft: DocumentationDraft): number {
  if (!draft.medical) return 1;
  if (draft.medical === "yes") return 0;
  return [!draft.expectedAt, !draft.contactName.trim(), !draft.contactPhone.trim()].filter(Boolean).length;
}

/** Every clearance answer asked: the question, plus the expected time and contact when not cleared. */
export function clearanceItems(draft: DocumentationDraft): number {
  return draft.medical === "no" ? 4 : 1;
}

/** Teams whose name, or a suburb they follow up in the source table, contains the search. */
export function communityTeamsMatching(teams: readonly string[], search: string): readonly string[] {
  const query = normaliseSuburbKey(search);
  if (!query) return teams;
  const bySuburb = new Set(
    S2015_CATCHMENT_ROWS.filter((row) => normaliseSuburbKey(row.suburb).includes(query)).flatMap((row) =>
      parseFollowUpClinicSet(row.followUpClinicVerbatim).map(communityTeamKey),
    ),
  );
  return teams.filter((team) => team.toLowerCase().includes(query) || bySuburb.has(communityTeamKey(team)));
}

/** The Ready to send row for the purpose, which the short form asks on its Referral step. */
export function communityPurposeRow(purpose: CommunityReferralPurpose | "") {
  return purpose
    ? ({ label: "Purpose", value: communityReferralPurposeLabel(purpose), state: "done" } as const)
    : ({ label: "Purpose", value: "Needed", state: "needed" } as const);
}
