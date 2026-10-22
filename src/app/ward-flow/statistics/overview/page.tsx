import { redirect } from "next/navigation";

import { STATISTICS_HOME_HREF } from "@/components/ward-management/statistics/statistics-sections";

/**
 * Overview was folded into the Statistics home on 21 October 2026 (D-77, change 9): Summary and
 * Overview became one Network page, and Overview's figures that Summary lacked (occupancy by
 * health service, empty to ready, admission stages) now sit on it. The route stays as a bookmark
 * backstop so an old link opens Network rather than a 404.
 */
export default function WardStatisticsOverviewRedirect() {
  redirect(STATISTICS_HOME_HREF);
}
