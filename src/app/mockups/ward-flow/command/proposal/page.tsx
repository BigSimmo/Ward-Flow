import type { Metadata } from "next";

import { CommandProposal } from "@/components/ward-management/coordinator/proposal/command-proposal";

export const metadata: Metadata = {
  title: "Command polish preview — Ward Flow",
  description: "The live Command screen with polish only, for review. Same structure and behaviour.",
};

/** Preview route for the 5 October 2026 Command polish. The live screen is unchanged. */
export default function CommandProposalPage() {
  return <CommandProposal />;
}
