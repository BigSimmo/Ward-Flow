import type { Metadata } from "next";

import { RedirectToFind } from "@/components/ward-management/hub/find-redirect";
import { WardIndex } from "@/components/ward-management/wards/ward-index";

export const metadata: Metadata = {
  title: "All wards — BedChart",
  description:
    "Synthetic ward index for the BedChart prototype — every ward grouped by health service, each linking to its own ward screen.",
};

export default function WardIndexPage() {
  return (
    <RedirectToFind tab="wards">
      <WardIndex />
    </RedirectToFind>
  );
}
