import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { serviceStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { StatisticsServiceScreen } from "@/components/ward-management/statistics/statistics-service-screen";
import { isKnownHealthService } from "@/components/ward-management/ward-known-places";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model-vocabulary";
import { safeDecodeURIComponent } from "@/components/ward-management/ward-safe-url";

// B2 (25 Oct 2026 design re-score): the tab names the place, so several open tabs can be told
// apart. An unknown id keeps the generic title; the typed address never reaches it (DR-20).
export async function generateMetadata({ params }: { params: Promise<{ serviceId: string }> }): Promise<Metadata> {
  const id = safeDecodeURIComponent((await params).serviceId);
  const name = isKnownHealthService(id) ? id : undefined;
  return {
    title: name ? `${name} — Statistics — Ward Flow` : "Health service statistics — Ward Flow",
    description: "Synthetic single-health-service statistics section for the Ward Flow prototype.",
  };
}

/**
 * One route serving every health service, not a page per service.
 *
 * `params` is a Promise in this version of Next and is awaited here; `decodeURIComponent` undoes
 * the encoding `serviceStatisticsHref` applies on the way out, so the pair stays symmetric — the
 * same reason `statistics/ward/[unitId]/page.tsx` and `statistics/ed/[edId]/page.tsx` decode
 * before handing the id to their screens. A name that resolves to no health service gets a real
 * 404 (DA-32) — never a redirect to a different service, and never an
 * empty page that reads as a service with nothing to show.
 */
/** "East Metro" reads "east-metro": lowercase words joined by hyphens. */
const slugOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");

export default async function StatisticsServicePage({ params }: { params: Promise<{ serviceId: string }> }) {
  const serviceId = safeDecodeURIComponent((await params).serviceId);
  // UX audit 21 Oct 2026: a lowercase slug ("east-metro"), as ward and team addresses use, opens the
  // same service at its one address instead of a 404. Only an exact slug of a real service does.
  const named = HEALTH_SERVICES.find((service) => slugOf(service) === serviceId);
  if (named !== undefined && named !== serviceId) redirect(serviceStatisticsHref(named));
  // DA-32: a name that is no health service shows "Page not found", not a page reporting success.
  if (!isKnownHealthService(serviceId)) notFound();
  return <StatisticsServiceScreen serviceId={serviceId} />;
}
