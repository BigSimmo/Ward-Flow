import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StatisticsWardScreen } from "@/components/ward-management/statistics/statistics-ward-screen";
import { knownWardUnit } from "@/components/ward-management/ward-known-places";
import { safeDecodeURIComponent } from "@/components/ward-management/ward-safe-url";

// B2 (25 Oct 2026 design re-score): the tab names the place, so several open tabs can be told
// apart. An unknown id keeps the generic title; the typed address never reaches it (DR-20).
export async function generateMetadata({ params }: { params: Promise<{ unitId: string }> }): Promise<Metadata> {
  const id = safeDecodeURIComponent((await params).unitId);
  const name = knownWardUnit(id)?.name;
  return {
    title: name ? `${name} — Statistics — Ward Flow` : "Ward statistics — Ward Flow",
    description: "Synthetic single-ward statistics section for the Ward Flow prototype.",
  };
}

/**
 * One route serving every ward, not a page per ward.
 *
 * `params` is a Promise in this version of Next and is awaited here; `decodeURIComponent` undoes
 * the encoding `wardStatisticsHref` applies on the way out, so the pair stays symmetric. An id that
 * resolves to no ward gets the not-found page (DA-32) — never a redirect to a different
 * ward, and never an empty page that reads as a ward with nothing to show.
 *
 * ⚠️ **It must never pass `units`.** The screen's override exists for tests; the route takes the
 * live network, so a ward resolves as it is rather than as it was seeded.
 */
export default async function WardStatisticsUnitPage({ params }: { params: Promise<{ unitId: string }> }) {
  const unitId = safeDecodeURIComponent((await params).unitId);
  // DA-32: an address that names no ward in any scenario shows "Page not found", not a page reporting success.
  if (!knownWardUnit(unitId)) notFound();
  return <StatisticsWardScreen unitId={unitId} />;
}
