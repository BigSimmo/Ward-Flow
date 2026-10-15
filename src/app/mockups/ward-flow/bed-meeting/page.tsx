import type { Metadata } from "next";

import { BedMeetingTvScreen } from "@/components/ward-management/bed-meeting/bed-meeting-tv";

export const metadata: Metadata = {
  title: "Bed meeting TV - Ward Flow",
  description: "Read only, large type bed meeting view for a meeting room screen. Synthetic data only.",
};

export default function WardBedMeetingTvPage() {
  return <BedMeetingTvScreen />;
}
