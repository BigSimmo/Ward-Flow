/**
 * EVERY FIGURE ROW, for the tests and the doc check only (figures spec 3.1). A screen imports the
 * one domain file it needs (`beds-figures.ts`, `ed-figures.ts`, ...), never this list: it would pull
 * every derivation onto the route. `eslint.config.mjs` blocks importing it under `src/`.
 */
import * as alertFigures from "@/components/ward-management/figures/alert-figures";
import * as bedsFigures from "@/components/ward-management/figures/beds-figures";
import * as dischargeFigures from "@/components/ward-management/figures/discharge-figures";
import * as edFigures from "@/components/ward-management/figures/ed-figures";
import * as edStatisticsFigures from "@/components/ward-management/figures/ed-statistics-figures";
import type { FigureRow } from "@/components/ward-management/figures/figure-row";

export const ALL_FIGURES: readonly FigureRow[] = [
  ...Object.values(bedsFigures),
  ...Object.values(edFigures),
  ...Object.values(edStatisticsFigures),
  ...Object.values(dischargeFigures),
  ...Object.values(alertFigures),
] as readonly FigureRow[];
