import type { Metadata } from "next";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";

/**
 * MERGE 02 (owner-approved 2026-09-05, `docs/superpowers/specs/2026-09-05-ward-flow-merges-1-3-design-lock.md`
 * §2) folded the former bed-state view and the morning bed state board into this one screen —
 * `CapacityScreen`. The Morning route redirected here for a time, then owner answer 41
 * (2026-09-17, `docs/ward-flow/owner-answers-2026-09-17.md`) retired it outright — this screen
 * is now the only place those figures are shown.
 */
export const metadata: Metadata = {
  title: "Capacity - Ward Flow",
  description: "Synthetic ward-confirmed mental health bed-state and capability view.",
};

export default function WardCapacityPage() {
  return <CapacityScreen />;
}
