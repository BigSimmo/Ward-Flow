import type { Metadata } from "next";

import { HubScreen } from "@/components/ward-management/hub/hub-screen";

export const metadata: Metadata = {
  title: "Search hub — Ward Flow",
  description:
    "Synthetic prototype: search wards, emergency departments and community teams from one place, with a live preview pane.",
};

export default function WardHubPage() {
  return <HubScreen />;
}
