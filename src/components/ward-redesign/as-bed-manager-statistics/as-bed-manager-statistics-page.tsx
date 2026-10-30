"use client";

import { BedManagerStatisticsRedesign } from "./bed-manager-statistics-redesign";

/**
 * As site bed manager: the Statistics mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open. The fork
 * beside this file holds the bed manager's branches (`siteCode` / `siteName`), each marked.
 */
export function AsBedManagerStatisticsPage() {
  return <BedManagerStatisticsRedesign />;
}
