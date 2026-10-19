import { communityTeamById } from "@/components/ward-management/community/community-derivations";
import { REFERRAL_SOURCES, type ReferralSource } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import { recordIdFromParam } from "@/components/ward-management/shell/ward-record-address";

/**
 * The referral slide-out is the one place a referral is written (Josh, 8 Oct 2026, option B). The
 * full-page form at `/ward-flow/referrals/new` is retired: that route now shows the
 * Referrals board with the slide-out open, and any link to it opens the slide-out in place.
 *
 * This module turns such a link into what the slide-out opens with. It reads the same query
 * `raiseReferralHref` (`shell/ward-facade.ts`) writes, and nothing else. `teamId` is read only as
 * a key into the community team pages, and only the team's NAME reaches the slide-out.
 */
export const REFERRAL_SHEET_PATH = "/ward-flow/referrals/new";

/** Where the referral goes. The slide-out's first choice. */
type ReferralSheetDestination = "ward" | "community" | "ed";

/** Where the referral comes from, as the slide-out groups it. */
export type ReferralSheetCategory = "community" | "ed" | "ward";

export type ReferralSheetRequest = {
  readonly category: ReferralSheetCategory;
  readonly destination?: ReferralSheetDestination;
  /**
   * A `Patient.id` from the link's `patientId` parameter, checked against the record by the
   * slide-out before it is used. Named `personId` here so no screen code reads a `.patientId`
   * property (D-14, `tests/ward-patient-link-default-deny.test.ts`).
   */
  readonly personId?: string;
  /** A `wardSites` code, resolved from `originEdId`. */
  readonly originSiteCode?: string;
  /** The referring community team's name, resolved from `teamId` against the team pages. */
  readonly sendingTeam?: string;
  /** Wards chosen before the slide-out opened, from `units`. The slide-out keeps only wards it lists. */
  readonly unitIds?: readonly string[];
};

const DESTINATIONS: readonly ReferralSheetDestination[] = ["ward", "community", "ed"];

function categoryForSource(source: ReferralSource | undefined): ReferralSheetCategory {
  if (source === "ed_medical") return "ed";
  if (source === "inter_hospital" || source === "psychiatric_ward") return "ward";
  return "community";
}

/** The request a query string carries. Unknown or blank values are dropped, never guessed. */
export function referralSheetRequestFromSearch(params: URLSearchParams): ReferralSheetRequest {
  const sourceValue = params.get("source")?.trim() ?? "";
  const source = (REFERRAL_SOURCES as readonly string[]).includes(sourceValue)
    ? (sourceValue as ReferralSource)
    : undefined;
  const referValue = params.get("refer")?.trim() ?? "";
  const destination = DESTINATIONS.find((value) => value === referValue);
  const personId = recordIdFromParam(params.get("patientId")?.trim()) ?? undefined;
  const edId = params.get("originEdId")?.trim() ?? "";
  const originSiteCode = edId ? allEmergencyDepartments().find((ed) => ed.id === edId)?.siteCode : undefined;
  const teamId = params.get("teamId")?.trim() ?? "";
  const sendingTeam = teamId ? communityTeamById(teamId)?.name : undefined;
  const unitIds = (params.get("units") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return {
    category: categoryForSource(source),
    ...(destination ? { destination } : {}),
    ...(personId ? { personId } : {}),
    ...(originSiteCode ? { originSiteCode } : {}),
    ...(sendingTeam ? { sendingTeam } : {}),
    ...(unitIds.length ? { unitIds } : {}),
  };
}

/** The request a link carries, or `null` when the link goes anywhere other than the slide-out route. */
export function referralSheetRequestFromHref(href: string, base: string): ReferralSheetRequest | null {
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  if (url.origin !== new URL(base).origin) return null;
  if (url.pathname.replace(/\/+$/, "") !== REFERRAL_SHEET_PATH) return null;
  return referralSheetRequestFromSearch(url.searchParams);
}
