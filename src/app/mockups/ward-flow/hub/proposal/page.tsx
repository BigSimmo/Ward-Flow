import type { Metadata } from "next";

import { HubPolish } from "@/components/ward-management/people-polish/hub-polish";

export const metadata: Metadata = {
  title: "Search hub polish preview — Ward Flow",
  description: "Polished Search hub for review: the current structure, with finish and wording improved.",
};

/** Preview route for the 5 October 2026 polish of the current Search hub (structure unchanged). */
export default function HubProposalPage() {
  return <HubPolish />;
}
