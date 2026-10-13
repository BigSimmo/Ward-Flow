import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SovereignShowcaseScreen } from "@/components/ward-management/sovereign/sovereign-showcase-screen";

export const metadata: Metadata = {
  title: "Design System Showcase - Ward Flow",
  description: "Synthetic examples of Ward Flow components, local interaction states and existing shell drawers.",
};

export default function SovereignShowcasePage() {
  // shell-20 (Josh, 13 Oct 2026): a developer reference only. Production builds answer not found;
  // `next dev` keeps it, and so does the offline test build (WARD_FLOW_SHOWCASE=1, set only by
  // scripts/test-environment.mjs) so the browser journeys can still check it.
  if (process.env.NODE_ENV === "production" && process.env.WARD_FLOW_SHOWCASE !== "1") notFound();
  return <SovereignShowcaseScreen />;
}
