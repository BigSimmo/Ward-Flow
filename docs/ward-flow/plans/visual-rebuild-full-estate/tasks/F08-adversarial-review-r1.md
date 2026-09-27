# F08 Discharges, Handover and Out of area adversarial source review r1

Date: 2026-09-13  
Scope: read-only comparison of the six F08 files against
`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F08/` and
`F08-report-r1.md`. No tests, browser, server, source edits, or Git mutation.

## Findings

- **P1 — Out of area’s “The five groups” count and provenance prose render literal dollar signs.**
  In `src/components/ward-management/out-of-area/out-of-area-board.tsx:284`, the JSX is
  `<dd>\${entries.length}</dd>`; at line 304 it says `count of \${notBanded} people`.
  In JSX these are literal `$` text followed by an expression, so the rendered values are
  `$N` rather than the numeric counts described by the report and the neighbouring count spans.
  This is a user-visible false presentation of the engine-derived figures and may break exact
  count assertions. Remove the literal dollar characters while retaining the expressions.

## Retention checks

Compared with the before snapshot, the three screen files retain the pre-existing test IDs, route
links, buttons/selects, population branches, and handlers. Discharges keeps all four
flag-before-stage groups and the excluded populations; Handover keeps scope filtering, urgent
outside-filter handling, sign-off/print actions, incoming-note absence, and Capacity link; Out of
area keeps ledger ordering, table/card responsive alternatives, row selection, placement details,
catchment absence, and provenance.

The new CSS modules compose the shell token layer and use local third-edition selectors. Their
desktop/mobile grid collapse and print rules are source-plausible, and no additional concrete loss
or missing dark-token mapping was found beyond the count interpolation defect above.

## Evidence boundary

The before-F08 manifest/snapshot is the valid baseline. This is source-only evidence; responsive
layout, keyboard activation, dark/forced-colors rendering, empty states, and print output remain
runtime/browser verification items. The implementation report’s static parsing result was not
repeated here.
