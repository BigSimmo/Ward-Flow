import type { Metadata } from "next";

import { LeaveScreen } from "@/components/ward-management/leave/leave-screen";

export const metadata: Metadata = {
  title: "Leave — Ward Flow",
  description: "Synthetic prototype: everyone on leave across your wards, when they are due back and their status.",
};

/** Feature 23 (Josh, 9 Nov 2026): reached from the Tools sheet's Leave due tool, "See all leave". */
export default function WardLeavePage() {
  return <LeaveScreen />;
}
