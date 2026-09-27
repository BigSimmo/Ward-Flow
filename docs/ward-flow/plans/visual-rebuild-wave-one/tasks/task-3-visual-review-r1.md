# Task 3 Statistics independent visual review — revision 1

Date: 2026-09-13  
Review scope: frozen r4 overview and compare app/drawing matrices at 390px, 820px and 1440px in light and dark themes; Task 3 revision 2 implementation report; prior independent source review.  
Evidence boundary: static image and focused source inspection only. No source, test, browser, server, or Git write was performed outside this report.

## Verdict

No actionable Statistics design or behavior issue is evident in the supplied r4 matrix. The four findings from `task-3-review-r1.md` are addressed in the current source and visible evidence where a static capture can establish them.

- The rebuilt frame no longer carries the obsolete phone-bar gap. Both overview and compare begin directly after the in-flow shared shell at 390px, and their content remains in the correct single content column at 820px and 1440px.
- Overview now keeps each capacity number with a visible source-backed explanation. Ready explicitly says it is the smaller of a unit's empty and allocatable counts; Empty and Allocatable also retain their meanings. The three cells remain readable at 820px and 1440px in both themes.
- Compare's table sits cleanly in its panel at 1440px without the former nested heavy frame. At 820px the visible table edge remains a clear overflow boundary, which is appropriate where the fixed-width columns extend past the viewport.
- The overview source mounts `usePrintableDisclosures` once and marks all three native disclosures with `source-print`, closing the source defect that left closed content hidden from print. Actual print expansion/restoration and PDF output are not proved by these screenshots.

## Overview matrix

The 1440px app cells establish the intended two independent content columns. Scope/capacity/lifecycle content occupies the left column and declines/work/provenance content occupies the right without cross-column row stretching. Panel headers, totals, table labels, noughts, explanatory prose and closed disclosure summaries remain readable in both themes. The app's full synthetic-data and coordinator-access warnings add height above the panels but remain required truth rather than layout drift.

At 820px the app intentionally resolves to one column, with a compact governance row and the capacity band visible without clipping. At 390px the shared rail, route controls and required governance material fill the first viewport before the analytical panels. No extra legacy top reserve, horizontal page overflow, clipped heading, or theme-specific overlap is visible.

The app's current counts differ from the drawing and it omits the drawing's fixed Snapshot and Service scope statements. Those are accepted engine/source differences recorded in the implementation report; copying the drawing values would introduce unsupported claims.

## Compare matrix

At 1440px the explanation panels and ward table use the available desktop width, preserve the fixed ward ordering and keep all four supported measures visible. The app explanation is longer than the drawing because it retains the corrected attribution and double-counting account; the first table remains visible in the viewport and the extra prose does not create clipping or overlap.

At 820px the single stack remains readable in both themes. The longer authoritative explanation pushes more of the table below the first app viewport than in the drawing, but it remains ordinary document flow rather than a constrained or hidden region. At 390px the first viewport reaches the required governance and section introduction; there is no obsolete frame offset or horizontal page overflow at the page level.

The source and revision 2 report retain both distinct populations, every ward and department measure, unit-bearing values, fixed model order, sticky identity columns, missing-data language, sideways-scroll notices, chooser links and corrected provenance. The drawing's shorter explanation and different synthetic values are not grounds to remove that material.

## Cells inspected

Viewed at original detail, app and drawing in both light and dark themes:

- Overview: 390px, 820px and 1440px — 12 images.
- Compare: 390px, 820px and 1440px — 12 images.

All captures use DPR 1 and scale 1. The app geometry records no open dialogs and expected visual widths of 375px, 805px and 1425px. Compare geometry records `scrollX: 0` and `scrollY: 0` for every cell. The six dark overview geometry files omit the two scroll fields, although the bitmaps visibly start at the same true document origin as their light partners; this is a metadata limit rather than a visible layout finding.

## Limits

The 390px first viewports do not prove the below-fold panels, table overflow interactions, chooser links, disclosures, provenance footer or later rows. The 820px captures prove more of overview but only the top of compare's first table. Static screenshots do not prove focus order, keyboard operation, sticky behavior while scrolling, disclosure interaction, forced-colours behavior, reduced motion, print expansion/restoration, actual PDF output or physical-device rendering. Those remain controller or human acceptance evidence rather than claims from this review.
