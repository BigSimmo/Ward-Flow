import type { Metadata } from "next";

import { RedirectToFind } from "@/components/ward-management/hub/find-redirect";
import { CommunityIndex } from "@/components/ward-management/community/community-index";

export const metadata: Metadata = {
  title: "Catchments — Places — BedChart",
  description:
    "Synthetic prototype: which community team covers a suburb, every team a referral can name from A to Z, and names that read alike.",
};

/**
 * PL1 (Josh, 3 Nov 2026): the community suburb lookup, A to Z and Read alike live here as the
 * Catchments tab of Places. `/bedchart/community` redirects here; each team's own page stays at
 * `/bedchart/community/[teamId]`.
 */
export default function PlacesCatchmentsPage() {
  return (
    <RedirectToFind tab="suburbs">
      <CommunityIndex inPlaces />
    </RedirectToFind>
  );
}
