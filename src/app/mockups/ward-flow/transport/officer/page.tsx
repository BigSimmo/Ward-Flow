import type { Metadata } from "next";

import { TransportHub } from "@/components/ward-management/officer/transport-hub";
import { OfficerScreen } from "@/components/ward-management/officer/officer-screen";

export const metadata: Metadata = {
  title: "Transport Hub — Ward Flow",
  description: "Synthetic transport jobs for the Ward Flow prototype.",
};

/**
 * The Transport Hub (redesign approved 5 October 2026). The earlier officer view stays reachable
 * from the hub's "Officer view" link (`?view=officer`).
 */
export default async function TransportOfficerPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  return view !== "officer" ? <TransportHub /> : <OfficerScreen />;
}
