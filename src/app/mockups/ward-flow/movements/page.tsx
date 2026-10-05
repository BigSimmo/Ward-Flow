import type { Metadata } from "next";

import { MovementsBoard } from "@/components/ward-management/movements/movements-board";
import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";

export const metadata: Metadata = {
  title: "Movements - Ward Flow",
  description: "Synthetic six-stage mental health patient-movement board.",
};

/**
 * The Movements board (redesign approved 5 October 2026). The earlier screen, with its movement
 * timeline, stays reachable from the board's "Movement timeline" link (`?view=timeline`).
 */
export default async function WardMovementsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  return view !== "timeline" ? <MovementsBoard /> : <MovementsScreen />;
}
