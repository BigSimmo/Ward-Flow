import type { Metadata } from "next";

import { CommunityIndex } from "@/components/ward-management/community/community-index";

export const metadata: Metadata = {
  title: "Catchments — Places — Ward Flow",
  description:
    "Synthetic prototype: which community team covers a suburb, every team a referral can name from A to Z, and names that read alike.",
};

/**
 * PL1 (Josh, 3 Nov 2026): the community suburb lookup, A to Z and Read alike live here as the
 * Catchments tab of Places. `/ward-flow/community` redirects here; each team's own page stays at
 * `/ward-flow/community/[teamId]`.
 */
export default function PlacesCatchmentsPage() {
  return <CommunityIndex inPlaces />;
}
