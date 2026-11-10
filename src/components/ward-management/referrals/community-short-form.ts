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

/** D-122 (Josh, 23 Oct 2026, recorded 10 Nov 2026): first contact sets the urgency tier. 24 hours is Tier 1, 72 hours Tier 2, 7 days Tier 3. */
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
  return draft.medical ? 0 : 1;
}

/** Teams whose name, or a suburb they follow up in the source table, contains the search. */
export function communityTeamsMatching(teams: readonly string[], search: string): readonly string[] {
  const query = normaliseSuburbKey(search);
  if (!query) return teams;
  const bySuburb = teamKeysForSuburbQuery(query);
  return teams.filter((team) => team.toLowerCase().includes(query) || bySuburb.has(communityTeamKey(team)));
}

/*
 * Search audit, 8 Nov 2026: the catchment table is fixed, so each suburb's team keys are parsed once
 * and the last query's answer is kept. Typing in the referral drawer no longer re-parses every
 * catchment row on each keystroke and each re-render.
 */
let suburbTeamKeys: readonly { readonly suburb: string; readonly teams: readonly string[] }[] | null = null;
let lastSuburbQuery: { readonly query: string; readonly keys: ReadonlySet<string> } | null = null;
function teamKeysForSuburbQuery(query: string): ReadonlySet<string> {
  if (lastSuburbQuery?.query === query) return lastSuburbQuery.keys;
  suburbTeamKeys ??= S2015_CATCHMENT_ROWS.map((row) => ({
    suburb: normaliseSuburbKey(row.suburb),
    teams: parseFollowUpClinicSet(row.followUpClinicVerbatim).map(communityTeamKey),
  }));
  const keys = new Set(suburbTeamKeys.filter((row) => row.suburb.includes(query)).flatMap((row) => row.teams));
  lastSuburbQuery = { query, keys };
  return keys;
}

/** The Ready to send row for the purpose, which the short form asks on its Referral step. */
export function communityPurposeRow(purpose: CommunityReferralPurpose | "") {
  return purpose
    ? ({ label: "Purpose", value: communityReferralPurposeLabel(purpose), state: "done" } as const)
    : ({ label: "Purpose", value: "Needed", state: "needed" } as const);
}
