"use client";

import { useIsPhone } from "@/components/wf";
import type { BrowseSegment } from "./statistics-browse";
import { StatisticsEdsIndexScreen } from "./statistics-eds-index";
import { StatisticsScreen } from "./statistics-screen";
import { StatisticsServicesIndexScreen } from "./statistics-services-index";
import { StatisticsTeamsIndexScreen } from "./statistics-teams-index";
import { StatisticsWardsIndexScreen } from "./statistics-wards-index";

/**
 * The four old index addresses (simplification mock-up, 26 Nov 2026). On a desktop or tablet each
 * opens Network on its Browse segment, so every link that names one still lands on that list. A
 * phone keeps the index page itself, whose list is already designed for it.
 */
export function StatisticsIndexRoute({ segment }: { segment: BrowseSegment }) {
  const isPhone = useIsPhone();
  if (!isPhone) return <StatisticsScreen browse={segment} />;
  if (segment === "eds") return <StatisticsEdsIndexScreen />;
  if (segment === "services") return <StatisticsServicesIndexScreen />;
  if (segment === "teams") return <StatisticsTeamsIndexScreen />;
  return <StatisticsWardsIndexScreen />;
}
