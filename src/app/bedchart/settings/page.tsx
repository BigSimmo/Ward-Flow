import type { Metadata } from "next";

import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";

export const metadata: Metadata = {
  title: "Settings — BedChart",
  description:
    "Per-browser preferences and the read-only thresholds for the BedChart prototype. Nothing here changes how any patient is treated.",
};

export default function WardSettingsPage() {
  return <SettingsScreen />;
}
