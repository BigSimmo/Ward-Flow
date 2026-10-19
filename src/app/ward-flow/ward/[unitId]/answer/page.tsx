import type { Metadata } from "next";

import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { unitById } from "@/components/ward-management/ward-sites";
import { safeDecodeURIComponent } from "@/components/ward-management/ward-safe-url";

export async function generateMetadata({ params }: { params: Promise<{ unitId: string }> }): Promise<Metadata> {
  const unit = unitById(safeDecodeURIComponent((await params).unitId));
  return {
    title: unit ? `Ward answer — ${unit.name}` : "Ward answer not found — Ward Flow",
    description: "Synthetic ward bed-request answer view for the Ward Flow prototype.",
  };
}

export default async function WardAnswerPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  return <WardScreen unitId={safeDecodeURIComponent(unitId)} presentation="answer" />;
}
