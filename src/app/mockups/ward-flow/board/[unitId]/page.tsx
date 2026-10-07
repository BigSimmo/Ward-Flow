import type { Metadata } from "next";

import { WardBoard } from "@/components/ward-management/board/ward-board";
import { safeDecodeURIComponent } from "@/lib/safe-url";

export const metadata: Metadata = {
  title: "Ward board — Ward Flow",
  description:
    "Synthetic ward board for the Ward Flow prototype — one tile per bed, shaded by how long the occupant has been in it.",
};

export default async function WardBoardPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  return <WardBoard unitId={safeDecodeURIComponent(unitId)} />;
}
