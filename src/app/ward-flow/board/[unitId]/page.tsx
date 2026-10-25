import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WardBoard } from "@/components/ward-management/board/ward-board";
import { knownWardUnit } from "@/components/ward-management/ward-known-places";
import { safeDecodeURIComponent } from "@/components/ward-management/ward-safe-url";

// DR-11: every board tab used to read "Ward board"; the ward's name (from the fixture, which the
// reducer never renames — see `ward/[unitId]/page.tsx`) tells them apart. An unknown id is never echoed.
export async function generateMetadata({ params }: { params: Promise<{ unitId: string }> }): Promise<Metadata> {
  const unit = knownWardUnit(safeDecodeURIComponent((await params).unitId));
  return {
    title: unit ? `${unit.name} board — Ward Flow` : "Ward board not found — Ward Flow",
    description:
      "Synthetic ward board for the Ward Flow prototype — one tile per bed, shaded by how long the occupant has been in it.",
  };
}

export default async function WardBoardPage({ params }: { params: Promise<{ unitId: string }> }) {
  const unitId = safeDecodeURIComponent((await params).unitId);
  // DA-32: an address that names no ward in any scenario shows "Page not found", not a page reporting success.
  if (!knownWardUnit(unitId)) notFound();
  return <WardBoard unitId={unitId} />;
}
