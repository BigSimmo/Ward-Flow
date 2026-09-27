# Task 5 Delays independent review — revision 1

Reviewed only the current Delays screen pair, `task-5-brief-r1.md`, `task-5-report-r1.md`, `task-5-static-report-r1.md`, and the twelve frozen `delays-r2` app/drawing captures. No source, test, browser, server, or Git operation was performed.

## Actionable findings

### 1. Moderate — the 820px owner strip wraps instead of retaining the drawing's compact horizontal strip

In both 820px app captures the five owner controls wrap into a three-card row followed by a two-card row. Both 820px drawing captures retain one row and explicitly tell the user to scroll sideways for the rest. The app therefore spends substantially more vertical space before the waiting list and changes the intended scan pattern at the tablet width.

The source explains the discrepancy: the historical `@media (max-width: 56rem)` rule changes `.ownerStrip` to three grid columns, while the final third-edition horizontal flex/overflow treatment begins only at `max-width: 640px`. Extend the third-edition single-row overflow treatment through the tablet range (or otherwise override the 56rem wrapping rule) while retaining the existing button facts, 48px target floor, keyboard access, pressed state, and accessible meter labels. Desktop 1440px should remain a five-column row.

### 2. Moderate — the selection instruction appears after the owner controls rather than with their heading

Across the app captures the first-panel header contains only “Who is holding people up” and the count. The drawings put “Choose one to mark those people. Nobody is ever hidden.” beside or immediately below that heading, before the wait band and owner controls. The equivalent app wording is retained only in the long footer after all five controls, so the user encounters the marking controls before the explanation; this is especially apparent in the 820px two-row layout.

Place the existing concise marking instruction before the controls, following the drawing's responsive header treatment. Keep the longer arrival-time explanation and the explicit “Nobody is ever hidden” guarantee; this is a presentation move, not permission to remove or rewrite the derivation disclosure.

### 3. Evidence blocker — the 1440px dark app cell is scaled to a narrower effective viewport

`delays-r2-app-1440-dark.png` does **not** show the More pages dialog. Source inspection confirms that the visible plain “Close” control belongs to the normal wide rail; the separate More pages `Sheet` would carry its own “More pages” dialog title and routes. Those dialog cues are absent.

Instead, the whole app cell is rendered at roughly four-thirds the scale of the matching light cell: the canonical 236px wide rail occupies about 313 bitmap pixels, typography and controls are correspondingly larger, and the remaining bar width is narrow enough for controls to cover the route title. This is consistent with an effective viewport near 1080 CSS pixels being scaled into a 1440px bitmap, or an equivalent non-100% page/capture scale. The matching light app and dark drawing cells use the expected 1440px geometry.

Treat the apparent clipping and displaced title as an invalid capture cell until reproduced at confirmed geometry. Recapture the dark app after recording `window.innerWidth`, `visualViewport.width`/`scale`, `devicePixelRatio`, page zoom, the rail bounding width, and the screenshot clip width. If those all prove a true 1440 CSS-pixel viewport at scale 1, then investigate the shared shell as a separate defect; no Delays-only CSS change is justified by this image.

## Source and behavior review

- The JSX continues to derive the four wait figures from `open` and the existing `waitingSplit`; reversing the three duration bands matches the drawing without changing the population.
- Owner buttons retain the existing mark/unmark handlers and `aria-pressed` state. Their meters use the existing owner/open counts and expose a complete accessible label.
- Patient, blocker, register, selected-person, attention, unnamed-person, and provenance content remains present. The richer patient and legal facts account for taller rows than the drawing and should not be removed for density.
- Marking still highlights rather than hides. Empty owner counts remain measured as “nobody”; empty cause groups remain omitted. No copied drawing population, clock, automatic selection, or new calculation was found.
- The 1440px light app columns closely follow the drawing's three-column geometry, and the independently bounded waiting/blocker regions visibly scroll. Selection uses full fill/ring treatment rather than a competing severity edge.
- The static report's 48px target, focus, forced-colors, canonical token, and 12px type-floor observations are consistent with the reviewed source. Runtime keyboard/focus and below-fold content were not retested in this review.

## Visual matrix inspected and limits

Viewed at original detail:

- 390px: app and drawing, light and dark.
- 820px: app and drawing, light and dark.
- 1440px: app and drawing, light and dark; the dark app cell was inspected but has the scale/viewport defect above.

The 390px captures show only the first viewport: they establish shell/header, disclosure, wait-band geometry, color treatment, and absence of visible horizontal page clipping, but they do not prove the below-fold owner strip, waiting rows, blocker/register panels, selected detail, attention panels, provenance disclosure, or their scrolling behavior. The 820px captures reach the waiting list and reveal the owner-strip breakpoint mismatch, but do not prove all later below-fold regions. The 1440px light cell exercises the three-column selected state; the dark desktop cell requires a clean geometry-controlled recapture. Physical-device, print/PDF, and human acceptance remain outside this review.

## Accepted differences from the drawing

- Engine populations, cause order, clocks, urgency wording, named records, and clearance/legal facts remain authoritative; the app's 43 waiting people therefore differ from the drawing's 16.
- The app's complete synthetic-data warning and truthful one-line subtitle add height.
- Existing mark filters, richer patient/detail facts, attention and unnamed-person panels, and full provenance remain available even where the drawing simplifies or omits them.
- Shared-shell route inventory, real route labels, global-search behavior, shift/reconciliation truth, and the absence of an unsupported Delays primary action are outside the Delays pair and were not treated as screen defects.

## r4 closure

The three revision-1 findings are closed in the final frozen `delays-r4` matrix. All twelve app/drawing images were viewed at original detail, and all twelve geometry sidecars were checked.

- Both 820px app cells retain all five owner controls in one horizontal strip with a visible scrollbar. The strip no longer wraps into a second row; each card keeps its value, owner, meter and explanatory/attention text.
- At 390px, 820px and 1440px in both themes, “Pressing an owner marks those people in the list below. Nobody is ever hidden.” appears before the owner controls. The longer arrival-time explanation remains after the strip.
- The new 1440px dark app capture has the expected geometry: width 1440, visual width 1425, rail width 236, DPR 1, scale 1, `scrollX: 0`, `scrollY: 0`, and no dialog. Its shell, title, governance line, owner panel and three-column Delays workspace align with the 1440px light app structure. The visible Close control belongs to the ordinary wide rail; there is no More pages dialog in the app capture.

The r4 app cells preserve the full synthetic-data warning, the engine-derived 43-person population, owner and duration facts, richer patient/blocker detail and the WF-014 selected-person account with stage “Moving.” Their values intentionally differ from the drawing's synthetic population. No new page-level overflow, clipping, theme mismatch or actionable focus concern is established by these static captures. The owner-strip overflow at 820px and the independently bounded desktop lists are deliberate local scroll regions rather than document overflow.

The geometry sidecars record the requested origin and scale in every cell, and the app cells contain no open dialog. The 390px first viewport still does not establish the below-fold owner strip, waiting rows, blocker/register panels, selected detail, attention panels or provenance disclosure. The 820px cells do not reach all later sections. Internal scroll-end, keyboard/focus, disclosure, provenance, print/PDF and physical-device acceptance remain controller-owned below-fold journey evidence.
