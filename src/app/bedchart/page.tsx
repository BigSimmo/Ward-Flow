import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";

export const metadata: Metadata = {
  title: "Home — BedChart",
  description:
    "Bed coordinator view: emergency department pressure, the priority queue, statewide flow and the explainable shortlist for one synthetic movement.",
};

type HomePageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

/**
 * Simplification mock-up (26 Nov 2026, area 2 item 1): Home's Flow tab is gone. An old `?list=queue`
 * bookmark opens Movements, whose worklist is arranged by stage by default and whose stage rail
 * filters it to one stage, as Flow's stage pills did.
 */
export default async function WardManagementPage({ searchParams }: HomePageProps) {
  const params = (await searchParams) ?? {};
  if (params.list === "queue") redirect("/bedchart/movements");
  return <CoordinatorScreen />;
}
