import type { Metadata } from "next";

import { SovereignShowcaseScreen } from "@/components/ward-management/sovereign/sovereign-showcase-screen";

export const metadata: Metadata = {
  title: "Design System Showcase - Ward Flow",
  description: "Synthetic examples of Ward Flow components, local interaction states and existing shell drawers.",
};

export default function SovereignShowcasePage() {
  return <SovereignShowcaseScreen />;
}
