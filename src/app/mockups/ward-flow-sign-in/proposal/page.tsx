import type { Metadata } from "next";

import { SignInProposal } from "@/components/ward-flow-sign-in/proposal/sign-in-proposal";

export const metadata: Metadata = {
  title: "Sign in redesign preview — Ward Flow",
  description: "Proposed sign-in screen for review. Synthetic prototype; it reads no live state.",
};

/** Preview route for the 5 October 2026 sign-in redesign proposal; a sibling of the current sign-in route. */
export default function SignInProposalPage() {
  return <SignInProposal />;
}
