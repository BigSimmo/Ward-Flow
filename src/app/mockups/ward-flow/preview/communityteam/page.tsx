import type { Metadata } from "next";

import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { wardPreviewOption } from "@/components/ward-management/preview/ward-preview-routes";

/** Preview only (device audit mockups): not in the nav. `?option=A|B|C` picks the mockup. */
export const metadata: Metadata = {
  title: "Community team mockup - Ward Flow",
  description: "Preview-only mockup of the Midland community team page on synthetic data.",
};

export default async function CommunityTeamPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ option?: string | string[] }>;
}) {
  return <CommunityScreen teamId="midland" preview={wardPreviewOption((await searchParams).option)} />;
}
