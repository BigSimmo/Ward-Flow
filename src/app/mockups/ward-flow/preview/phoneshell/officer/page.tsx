import type { Metadata } from "next";

import { PhoneShellPreview } from "@/components/ward-management/preview/phone-shell-preview";
import { wardPreviewOption } from "@/components/ward-management/preview/ward-preview-routes";

/** Preview only (device audit mockups): not in the nav. `?option=A|B|C` picks the mockup. */
export const metadata: Metadata = {
  title: "Phone shell mockup - Ward Flow",
  description: "Preview-only mockup of the phone dock, Menu and Create sheet on synthetic data.",
};

export default async function PhoneShellPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ option?: string | string[] }>;
}) {
  return <PhoneShellPreview page="officer" option={wardPreviewOption((await searchParams).option)} />;
}
