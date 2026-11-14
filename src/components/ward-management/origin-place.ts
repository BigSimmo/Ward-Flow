// Wave 4 (Home notes item 6, A16-23; review FS-7): where a referral came from, in words, not a site
// code to decode. One rule for Home's referral rows, its act-now rows, the kept pulled row, Alerts'
// phone pull rows and the Pull the bed form's From line, so they all name the same place.

import { ORIGIN_NOT_RECORDED, type Referral } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";

/** Row text only: "Emergency Department" reads as "ED", as Placement's own header already does. */
export function shortPlace(place: string): string {
  return place.replace(/\bEmergency Department\b/g, "ED");
}

/**
 * The referral's origin in full words ("Royal Perth ED"; "Bunbury" for a site with no ED). Falls
 * back to the recorded code when the directory does not know it, then to "not recorded".
 */
export function originPlace(referral: Pick<Referral, "originSiteCode">): string {
  const code = referral.originSiteCode;
  if (code === undefined) return ORIGIN_NOT_RECORDED;
  const ed = allEmergencyDepartments().find((place) => place.siteCode === code);
  const name = ed?.name ?? siteByCode(code)?.name;
  return name ? shortPlace(name).replace(/\s*\b(Public )?Hospital\b/gu, "") : code;
}
