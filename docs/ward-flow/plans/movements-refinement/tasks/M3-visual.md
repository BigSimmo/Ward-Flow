# M3 — supplied-capture visual review

## Verdict

No remaining P1, P2, or material design defect is visible in the supplied Movements captures. No numerical score is assigned because the review evidence supports observed qualities, not an anchored 10-point rating.

Across 1440, 820, and 390 pixels, the implementation preserves the drawing’s main hierarchy: page controls, a compact day summary, the attention band, and then the traffic workspace. Metric cards keep consistent boundaries and readable emphasis in light and dark themes. The attention records remain distinct actions rather than becoming another dense table. At narrow widths the cards reflow cleanly without page-level horizontal overflow, clipped controls, or broken panel edges.

The traffic workspace retains a clear separation between the schematic and the ranked corridor register. The latest dark 1440 capture confirms that removing the redundant From/To labels resolves the earlier endpoint overlap; endpoint names, totals, route lines, legend, disclosure, and independent scroll boundaries remain legible. The light 1440 capture predates that small correction and was not treated as evidence of a remaining defect. The in-flight unique-corridor totals and ranked-label wording change semantics only and do not alter this layout verdict.

The responsive shell adds vertical content before the page compared with the static drawing, but it remains structured, scrolls out of the way, and does not obscure or overlap Movements content. The 390-pixel day panel remains usable as an ordinary vertical scroll rather than compressing six metrics and attention records into unreadable rows.

## Evidence boundary

Compared `movements-{1440,820,390}-dark.png` with `movements-mock-{390,820}-dark.png` and `movements-mock-1440-dark-final.png`, plus `movements-1440-light-final.png` and `movements-{820,390}-light.png` with `movements-mock-{820,390}.png`, using the local image viewer. This verdict covers hierarchy, spacing, boundaries, responsive reflow, and visible legibility in those images only. The restored lower worklist, Transport detail, patient routing, keyboard behavior, and live scroll interaction remain with the root verification. No browser run, tests, or product-source edits were performed.
