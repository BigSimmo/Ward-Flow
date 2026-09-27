// src/components/ward-management/statistics/statistics-demonstration-chart.tsx
//
// THE ONLY FUNCTION IN THIS CODEBASE THAT MAY RENDER A DemonstrationSeries.
//
// ⚠️ **NAMED `-chart.tsx`, NOT `statistics-demonstration.tsx`, AND THAT IS A DELIBERATE DEVIATION
// FROM THE BRIEF'S LITERAL FILENAME, RECORDED HERE RATHER THAN SILENTLY MADE.** A file
// `statistics-demonstration.tsx` sitting beside `statistics-demonstration.ts` would share that
// module's bare import specifier (`@/…/statistics-demonstration`), and TypeScript's resolver tries
// the `.ts` extension before `.tsx` and stops the moment it finds a match — verified empirically
// against this project's own `tsconfig.json` with `--traceResolution` before writing this file.
// Every bare, extensionless import of that specifier would therefore resolve to the `.ts` file
// forever, and `DemonstrationChart` — which only exists in the `.tsx` file — would be permanently
// unreachable by the same import convention every other module in this codebase uses. That is not
// a naming preference; it is a module the rest of the app could never import. Giving the wrapper
// its own basename is the smallest change that keeps both files real, importable modules.
//
// ⚠️ **WHY A WRAPPER AT ALL, RESTATED FROM `statistics-demonstration.ts`'s OWN HEADER.** A branded
// `DemonstrationSeries` cannot be ACCIDENTALLY rendered by anything that was not written to expect
// one — the compiler enforces that separation for every ordinary caller, not a reviewer. A
// deliberate `as DemonstrationSeries` cast, or a file that reads `.points` straight off whatever
// `generateDemonstrationSeries` returns without ever naming this type, both get past the compiler;
// see `statistics-demonstration.ts`'s header and `tests/ward-statistics-demonstration.test.ts` for
// what actually stops each. This component is the one place the wrapper's expectation is met, and
// the one place a demonstration series' three disclosure fields
// (`label`, `whatItWouldMeasure`, `whyItIsNotReal`) are actually shown to whoever is looking at the
// screen — not merely carried in an `aria-label`, the same discipline `WardBar` (`ward-bar.tsx`)
// already holds to after a real defect: a caption that exists only for a screen reader leaves the
// sighted reader looking at a picture with no visible account of what it is.
//
// This module deliberately draws its own inline SVG rather than adding a dependency: nothing under
// `ward-management/` renders a chart today (`statistics.module.css`'s own `.chartWrap`/`.chartSvg`/
// `.chartCaption` classes were ported from the design prototype and, at the time this file was
// written, had no consumer anywhere in this tree — confirmed by grep before reuse), so there is no
// existing chart primitive this could delegate to instead.
"use client";

import type { DemonstrationSeries } from "@/components/ward-management/statistics/statistics-demonstration";

import styles from "./statistics.module.css";

// 🔴 NO LINE IS DRAWN ANY MORE — Josh, 25 September 2026: "the made-up 30-day (and 14-day) trend
// charts on the statistics pages show 'Not recorded' until real history exists." Until then this
// component drew the generated series as a line, badged "Demonstration data". It now shows the
// series' own label with "Not recorded" and its two disclosure fields, and draws nothing: a badge
// beside an invented line still puts an invented line in front of a clinician. The series type and
// the generator stay, so a screen that gains real history replaces a call here rather than a design.

/**
 * `series` is typed `DemonstrationSeries`, and that type is unreachable from outside
 * `statistics-demonstration.ts` without a cast (see its header) — so every value that reaches this
 * prop through ordinary, cast-free code is one `generateDemonstrationSeries` produced. There is no
 * second cast-free constructor to bypass; there is a cast, `{ ... } as DemonstrationSeries`, and it
 * is not this component's job to stop one — it is written down wherever it happens, which is what
 * review is for.
 */
export function DemonstrationChart({
  series,
  testId,
}: {
  readonly series: DemonstrationSeries;
  readonly testId?: string;
  /** Kept so callers need not change; both variants now render the same "Not recorded" statement. */
  readonly variant?: "default" | "overview";
}) {
  return (
    <div
      className={styles.chartWrap}
      data-ward-primitive="demonstration-chart"
      data-figure-kind="not-recorded"
      data-testid={testId}
    >
      <p className={styles.chartCaption}>
        <span className={styles.prototypeBadge}>Not recorded</span> {series.label}
      </p>
      <p className={styles.chartCaption}>
        If the model could compute this, it would show <b>{series.whatItWouldMeasure}</b>. It cannot:{" "}
        {series.whyItIsNotReal}
      </p>
    </div>
  );
}
