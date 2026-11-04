import type { Metadata } from "next";

import { SeclusionRoute } from "@/components/ward-management/restrictive-practice/seclusion-route";

export const metadata: Metadata = {
  title: "Seclusion and restraint — Ward Flow",
  description:
    "Synthetic prototype, operational view only: seclusion and restraint in use now, seclusion room status and ward incidents. No legal register.",
};

export default function WardSeclusionPage() {
  // FS3: desks that open Forms are sent to its Seclusion and restraint view.
  return <SeclusionRoute />;
}
