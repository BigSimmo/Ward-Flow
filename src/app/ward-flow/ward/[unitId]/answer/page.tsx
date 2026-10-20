import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { knownWardUnit } from "@/components/ward-management/ward-known-places";
import { safeDecodeURIComponent } from "@/components/ward-management/ward-safe-url";

export async function generateMetadata({ params }: { params: Promise<{ unitId: string }> }): Promise<Metadata> {
  const unit = knownWardUnit(safeDecodeURIComponent((await params).unitId));
  return {
    title: unit ? `Ward answer — ${unit.name}` : "Ward answer not found — Ward Flow",
    description: "Synthetic ward bed-request answer view for the Ward Flow prototype.",
  };
}

export default async function WardAnswerPage({ params }: { params: Promise<{ unitId: string }> }) {
  const unitId = safeDecodeURIComponent((await params).unitId);
  // DA-32: an address that names no ward in any scenario is a real 404, not a page reporting success.
  if (!knownWardUnit(unitId)) notFound();
  return <WardScreen unitId={unitId} presentation="answer" />;
}
