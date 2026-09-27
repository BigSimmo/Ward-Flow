# Network r19 P2 correction

Date: 2026-09-13

Owned file: `src/components/ward-management/ward-management-network-third-edition.module.css` only.

The r19 visual review found the Network flow instrument still read as a second grid of large cards. The drawing uses a compact schematic with aligned ED rows, unit rows, and dense state swatches. The correction is CSS-only and scoped through `data-testid="ward-diagram-scroll"`: ED nodes now paint as flat aligned rows; unit buttons now paint as flat aligned rows with the existing state chips spanning a compact horizontal row; chip text and all existing derived figures remain visible. Existing selected/routed outlines, button semantics, callbacks, and the independent overflow boundary are retained. The 48px unit-button target remains provided by the existing `min-height: var(--ward-tap)` rule.

Before snapshot: `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-network-r19-p2.module.css`

Before SHA-256: `722231314122DDCDA41344248476310436654FEFB2E7905013DF965B6FFE201E`

Current SHA-256: `1991A5299D84325F50B4F46A44B9238F36F72001A2DF605D1E00D2A540CEE3FE`

Checks run: `postcss.parse` on the changed CSS passed; `git diff --check -- src/components/ward-management/ward-management-network-third-edition.module.css` passed. No tests or browser capture were run by this task, so the rendered result remains for parent visual review.
