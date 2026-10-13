import type { Referral } from "@/components/ward-management/ward-model";

/**
 * Whether a referral comes from a community team rather than a hospital or ED: a CMHT or clinic
 * site code, or a referral whose source is `community`.
 *
 * One definition for search, filters, previews and the census. `homeRegion` is one of the ten WA
 * regions, never "Community", so it cannot say anything about this.
 */
export function isCommunityReferral(referral: Pick<Referral, "originSiteCode" | "source">): boolean {
  return (
    referral.originSiteCode.includes("CMHT") ||
    referral.originSiteCode.includes("Clinic") ||
    referral.source === "community"
  );
}
