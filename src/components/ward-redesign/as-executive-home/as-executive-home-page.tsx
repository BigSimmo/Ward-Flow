"use client";

import { AsExecutiveStatisticsRedesign } from "./statistics-redesign";
import chipFade from "@/components/ward-redesign/statistics/statistics-chip-fade.module.css";

/**
 * As executive: the Statistics mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open. The fork
 * beside this file (`statistics-redesign.tsx`) carries the executive's changes as commented
 * `executive` branches: the small number rule explained once, and no "not shown" chips or charts.
 */
export function AsExecutiveHomePage() {
  // Josh, 31 Oct 2026: the phone chip row fades at an edge with more chips past it
  // (`statistics-chip-fade.module.css`).
  return (
    <div className={chipFade.scope}>
      <AsExecutiveStatisticsRedesign />
    </div>
  );
}
