import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WardBoard } from "@/components/ward-management/board/ward-board";
import { knownWardUnit } from "@/components/ward-management/ward-known-places";
import { safeDecodeURIComponent } from "@/components/ward-management/ward-safe-url";

export const metadata: Metadata = {
  title: "Ward board — Ward Flow",
  description:
    "Synthetic ward board for the Ward Flow prototype — one tile per bed, shaded by how long the occupant has been in it.",
};

export default async function WardBoardPage({ params }: { params: Promise<{ unitId: string }> }) {
  const unitId = safeDecodeURIComponent((await params).unitId);
  // DA-32: an address that names no ward in any scenario is a real 404, not a page reporting success.
  if (!knownWardUnit(unitId)) notFound();
  return <WardBoard unitId={unitId} />;
}
