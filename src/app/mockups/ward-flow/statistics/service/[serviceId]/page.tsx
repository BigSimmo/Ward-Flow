import type { Metadata } from "next";

import { StatisticsServiceScreen } from "@/components/ward-management/statistics/statistics-service-screen";
import { safeDecodeURIComponent } from "@/lib/safe-url";

export const metadata: Metadata = {
  title: "Health service statistics — Ward Flow",
  description: "Synthetic single-health-service statistics section for the Ward Flow prototype.",
};

/**
 * One route serving every health service, not a page per service.
 *
 * `params` is a Promise in this version of Next and is awaited here; `decodeURIComponent` undoes
 * the encoding `serviceStatisticsHref` applies on the way out, so the pair stays symmetric — the
 * same reason `statistics/ward/[unitId]/page.tsx` and `statistics/ed/[edId]/page.tsx` decode
 * before handing the id to their screens. A name that resolves to no health service is the
 * screen's own honest not-found state — never a redirect to a different service, and never an
 * empty page that reads as a service with nothing to show.
 */
export default async function StatisticsServicePage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  return <StatisticsServiceScreen serviceId={safeDecodeURIComponent(serviceId)} />;
}
