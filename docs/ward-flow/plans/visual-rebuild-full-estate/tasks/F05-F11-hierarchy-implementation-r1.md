# F05/F11 Community and Service hierarchy implementation

Date: 2026-09-13
Owner: Codex Luna

## Change

Added drawing-aligned CSS grid ordering in the two existing third-edition module styles. Community now presents identity, hospital discharges, Caseload, case-age, first-contact/grouped, then the remaining referral, contact, comparison, provenance and limits panels. Service now presents identity, ready beds, referral placement, out-of-area, then flow. The identity panels are no longer forced full-width, allowing the two-column drawing composition while the existing grid collapses on narrow screens.

No JSX, calculations, test IDs, links, absence/provenance text, or shared frame files were changed by this task. The existing working-tree TSX deltas were preserved. The near-white light-theme body-copy issue is owned by the shared frame correction and was not duplicated here.

## Checks

- TypeScript `transpileModule` syntax diagnostics on the two screen files: 0 diagnostics each.
- PostCSS parse on both module files: passed.
- Prettier check on all four authorized files: passed after formatting the two new module files.
- Tests, browser, server and provider checks: not run by scope.

## Limits

This is a source/static change only. Visual ordering and light/dark presentation still require the parent’s rendered review; no acceptance or DOD claim is made.
