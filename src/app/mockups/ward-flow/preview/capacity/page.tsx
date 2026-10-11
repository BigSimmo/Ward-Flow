import type { Metadata } from "next";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { wardPreviewOption } from "@/components/ward-management/preview/ward-preview-routes";

/** Preview only (device audit mockups): not in the nav. `?option=A|B|C` picks the mockup. */
export const metadata: Metadata = {
  title: "Capacity mockup - Ward Flow",
  description: "Preview-only mockup of the Capacity bed map on synthetic data.",
};

export default async function CapacityPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ option?: string | string[] }>;
}) {
  return <CapacityScreen preview={wardPreviewOption((await searchParams).option)} />;
}
