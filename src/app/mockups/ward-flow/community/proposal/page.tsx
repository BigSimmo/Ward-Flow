import type { Metadata } from "next";

import { CommunityIndexPolished } from "@/components/ward-management/community/polished/community-index-polished";

export const metadata: Metadata = {
  title: "Community teams polish preview — Ward Flow",
  description: "The current community hub, polished in place, built on the live synthetic Ward Flow state.",
};

/** Preview route for the polished community hub (same structure as the current page). The current hub is unchanged. */
export default function CommunityHubProposalPage() {
  return <CommunityIndexPolished />;
}
