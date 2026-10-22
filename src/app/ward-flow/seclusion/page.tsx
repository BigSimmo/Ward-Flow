import type { Metadata } from "next";

import { SeclusionScreen } from "@/components/ward-management/restrictive-practice/seclusion-screen";

export const metadata: Metadata = {
  title: "Seclusion and restraint — Ward Flow",
  description:
    "Synthetic prototype, operational view only: seclusion and restraint in use now, seclusion room status and ward incidents. No legal register.",
};

export default function WardSeclusionPage() {
  return <SeclusionScreen />;
}
