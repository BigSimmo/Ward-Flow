# F05 Service statistics correction r27

Date: 2026-09-13  
Scope: `src/components/ward-management/statistics/statistics-service-third-edition.module.css` only

## Change

- `.pageGrid` now uses `minmax(0, 1.1fr) minmax(0, 0.9fr)` at the wide layout, matching the drawing's approximately 55/45 split while retaining the existing 62.5 rem single-column breakpoint.
- `.identityFacts > div` retains a compact two-column definition-list layout at the 40 rem phone breakpoint with a bounded 6.5 rem label track.
- `.identityFacts dd` stays in column two on phone and has `min-width: 0` plus `overflow-wrap: anywhere`, so long hospital names wrap inside the available value track rather than forcing overflow.
- `.bandList > li`, KPI, placement, panel order, single-column breakpoint, and print rules are unchanged.

No data, counts, absence wording, actions, panels, component markup, shared styles, or engine behavior changed.

## Evidence

- Before snapshot: `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-service-r27/statistics-service-third-edition.module.css`
- Before SHA-256: `0A06F7BFF181B1D6ABBC8D00C7962E7E2BADA39907B7FC1B7D2796E2721DFF10`
- After SHA-256: `035377D87291CA7EF7DADF11B88A66322E52F52304F31F2D48DEE6BA8C1BA9E2`
- Formatting: `node_modules/.bin/prettier.cmd --write src/components/ward-management/statistics/statistics-service-third-edition.module.css` — completed, file unchanged by formatter.
- Tests and browser checks were not run by instruction; rendered closure remains controller-owned.
