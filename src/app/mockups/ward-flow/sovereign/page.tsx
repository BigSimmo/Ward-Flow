import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SovereignShowcaseScreen } from "@/components/ward-management/sovereign/sovereign-showcase-screen";

export const metadata: Metadata = {
  title: "Design System Showcase - Ward Flow",
  description: "Synthetic examples of Ward Flow components, local interaction states and existing shell drawers.",
};

export default function SovereignShowcasePage() {
  // shell-20 (Josh, 13 Oct 2026): a developer reference only. Only `next dev` and the offline test
  // build (WARD_FLOW_SHOWCASE=1, set only by scripts/test-environment.mjs, so the browser journeys
  // can still check it) show it; anything else, an unset NODE_ENV included, answers not found.
  if (process.env.NODE_ENV !== "development" && process.env.WARD_FLOW_SHOWCASE !== "1") notFound();
  return <SovereignShowcaseScreen />;
}
