"use client";

import { AsExecutiveStatisticsRedesign } from "./statistics-redesign";

/**
 * As executive: the Statistics mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open. The fork
 * beside this file (`statistics-redesign.tsx`) carries the executive's changes as commented
 * `executive` branches: the small number rule explained once, and no "not shown" chips or charts.
 */
export function AsExecutiveHomePage() {
  return <AsExecutiveStatisticsRedesign />;
}
