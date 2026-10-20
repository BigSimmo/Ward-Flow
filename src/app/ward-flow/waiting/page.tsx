import type { Metadata } from "next";

import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";

export const metadata: Metadata = {
  title: "Waiting — Ward Flow",
  description:
    "Synthetic prototype: why each waiting patient is still waiting. Merges the former priority queue, exceptions inbox and escalation board into one list, grouped by cause.",
};

/** B4 step 3 (Josh, 19 Oct 2026): the Delays board is now the Waiting list. `/delays` redirects here. */
export default function WardWaitingPage() {
  return <DelaysScreen />;
}
