import type { Metadata } from "next";

import { NightViewScreen } from "@/components/ward-management/night/night-view-screen";

export const metadata: Metadata = {
  title: "Night view — Ward Flow",
  description:
    "Synthetic prototype: the coordinator's overnight screen. Beds ready, ED waits by Step, who is on the way, intake windows and on-call lines.",
};

export default function WardNightViewPage() {
  return <NightViewScreen />;
}
