import type { Metadata } from "next";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";

export const metadata: Metadata = {
  title: "Alerts — Ward Flow",
  description:
    "Synthetic prototype: what is addressed to a role right now across every movement and referral, and what this screen does not watch.",
};

export default function WardAlertsPage() {
  return <AlertsScreen />;
}
