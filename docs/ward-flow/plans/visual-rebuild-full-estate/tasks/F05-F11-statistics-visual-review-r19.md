# F05/F11 Statistics visual review r19

Date: 2026-09-13  
Reviewer: `gpt-5.6-sol / medium`  
Role: independent visual reviewer for Statistics landing and Community; implementation author for Service and Ward, so findings on those two pages are an adversarial self-review rather than independent acceptance.

## Evidence inspected

I opened all 48 original PNGs in `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/`:

- `statistics-{app,mock}-{390,820,1440}-{light,dark}-r19.png`
- `statistics-community-{app,mock}-{390,820,1440}-{light,dark}-r19.png`
- `statistics-service-{app,mock}-{390,820,1440}-{light,dark}-r19.png`
- `statistics-ward-{app,mock}-{390,820,1440}-{light,dark}-r19.png`

These are first-viewport comparisons. They do not prove below-fold order, disclosure behavior, keyboard behavior, print, or browser interaction. Engine populations and values were treated as authoritative; differences in names, counts, absent measures, and demonstration data were not recorded as visual defects.

## Findings

### P2 — Ward discharge-share label collapses at desktop widths

In both `statistics-ward-app-1440-{light,dark}-r19.png`, **Share of the ward with a date** wraps nearly one word per line. The shared fact-row grid allows the label track to shrink to min-content while the explanatory value takes the remaining width. The corresponding mockup keeps a readable label/value row.

Smallest correction: give only this long row a bounded label/value track, and stack it below the phone breakpoint so the correction cannot create horizontal overflow.

### P2 — Ward clinically-ready summary is prose-shaped rather than a KPI band

In both Ward desktop app cells, the existing blocked count and share are embedded in two equal-width paragraphs. The mockup presents those same concepts as two prominent numeric figures with labels and denominator prose. The app therefore hides the section's primary figures even though both values are already derived and rendered.

Smallest correction: retain the current derivations, test IDs, zero/unmeasured branches, denominators, and clinical wording, but place the existing count and measured percentage in numeric KPI elements with explanatory text beneath.

## No further P1/P2 found in the observed cells

- **Statistics landing:** the six-region summary remains readable and ordered across all six cells. The app's compact governance disclosure and richer engine-backed counts are accepted product adaptations.
- **Community statistics:** the parent/subregion grouping, absent-measure explanations, and four-figure caseload band remain legible in both themes and at 390, 820, and 1440 widths. The Bentley zero/absence population differs from the populated drawing but is an engine-data difference.
- **Service statistics:** identity, ready-bed table, referral placement, out-of-area band, and flow panels retain the intended two-column desktop and one-column narrow structure. No new clipping, overlap, or unreadable control was visible. The app's longer measurement caveats and current North Metro figures are governed content differences.
- **Ward statistics apart from the two findings above:** identity-first order, left Beds/Occupancy stack, right Discharge/Ready stack, table containment, theme contrast, and narrow single-column flow remain coherent. The missing drawing-only monthly history is explicitly explained by the existing product contract and was not treated as a visual omission.

Human acceptance remains pending after a served recapture of the Ward correction.
