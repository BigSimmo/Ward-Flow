"use client";

import { BedManagerStatisticsRedesign } from "./bed-manager-statistics-redesign";
import chipFade from "@/components/ward-redesign/statistics/statistics-chip-fade.module.css";

/**
 * As site bed manager: the Statistics mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open. The fork
 * beside this file holds the bed manager's branches (`siteCode` / `siteName`), each marked.
 */
export function AsBedManagerStatisticsPage() {
  // Josh, 31 Oct 2026: the phone chip row fades at an edge with more chips past it
  // (`statistics-chip-fade.module.css`).
  return (
    <div className={chipFade.scope}>
      <BedManagerStatisticsRedesign />
    </div>
  );
}
