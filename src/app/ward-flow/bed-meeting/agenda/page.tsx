import type { Metadata } from "next";

import { BedMeetingAgendaScreen } from "@/components/ward-management/bed-meeting/bed-meeting-agenda-screen";

export const metadata: Metadata = {
  title: "Bed meeting agenda — Ward Flow",
  description:
    "Synthetic prototype: the bed meeting agenda built from fixed rules, and the actions it agreed, with an owner and a due time.",
};

export default function WardBedMeetingAgendaPage() {
  return <BedMeetingAgendaScreen />;
}
