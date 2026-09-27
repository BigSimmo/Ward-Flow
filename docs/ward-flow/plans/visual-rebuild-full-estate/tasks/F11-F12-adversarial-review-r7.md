# F11/F12 adversarial review r7

Scope: source-only comparison against the named before snapshots. No tests, browser, server, provider, or source edits.

## Finding

- P2 — invalid dl group content in Statistics landing. In src/components/ward-management/statistics/statistics-screen.tsx:254-285, metricBand is a <dl> whose six <div> groups contain <dt>, <dd>, then a plain <p>. A dl group may contain only dt/one-or-more dd terms (the wrapper div is allowed); the explanatory sentence is not a definition-description element. This risks inconsistent accessibility-tree/definition-list interpretation. Preserve the visible copy, but move each sentence outside the dl group or render it as a second styled dd with the intended semantics. The same issue is not present in the reviewed Settings facts lists or Ward statistics lists, whose dl children are valid dt/dd groups.

## Truth and behavior review

The landing metric expressions remain engine-derived and retain explicit unavailable handling for arrivals.averageMinutes === null. The detailed arrival branch renders “No admission ... no average” when the measured set is empty, and the incoherent count remains visible when arrival precedes pull. No current source path clamps a negative gap into zero; the derivation excludes and counts it. The one-value and equal-range guards are explicit. No fabricated metric, dropped absence branch, or negative-average regression was found in the reviewed Statistics delta.

The F12 Settings source retains appearance and rail handlers, threshold state/readout, handover link, table semantics, and print-related content. Sign In retains role/action/refusal lists, local role selection, announcement-only “Go in” behavior, appearance control, and reconciliation copy. The F12 CSS continues to use dark-aware shared tokens and preserves 48px controls/focus rules. No concrete navigation, disclosure-state, print, or dark-token defect was found source-side.

## Snapshot limitation

The Statistics before directory contains only the landing TSX/CSS and manifest; the report’s before-statistics-visual-r7 snapshot therefore does not independently cover all five Statistics route sources. F12 has complete four-file before copies. This review is source-only and is not rendered proof.
