import type { Metadata } from "next";

import { SettingsProposal } from "@/components/ward-management/oversight-proposal/settings-proposal";

export const metadata: Metadata = {
  title: "Settings redesign preview — Ward Flow",
  description: "Proposed settings screen for review, built on the live synthetic Ward Flow state.",
};

/** Preview route for the 5 October 2026 settings redesign proposal. The current screen is unchanged. */
export default function SettingsProposalPage() {
  return <SettingsProposal />;
}
