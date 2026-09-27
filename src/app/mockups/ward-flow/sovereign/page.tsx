import type { Metadata } from "next";

import { SovereignShowcaseScreen } from "@/components/ward-management/sovereign/sovereign-showcase-screen";

export const metadata: Metadata = {
  title: "Sovereign Chrome & Drawers Suite - Ward Flow",
  description: "Sovereign chrome, navigation rail, and drawers suite perfected third edition showcase.",
};

export default function SovereignShowcasePage() {
  return <SovereignShowcaseScreen />;
}
