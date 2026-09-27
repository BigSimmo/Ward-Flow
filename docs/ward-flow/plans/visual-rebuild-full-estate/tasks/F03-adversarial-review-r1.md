# F03 Patient Search and Patient Now adversarial source review r1

Date: 2026-09-13  
Scope: read-only review of the six F03 files against the authoritative
`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-F03/` copies and
`F03-patient-search-now-report-r1.md`. No tests, browser, server, Git mutation, or source edits.

## Finding

- **P1 — Patient Now identity panel does not receive the promised full-width desktop placement.**
  In `src/components/ward-management/patients/person.module.css:614`, the rule
  `.recordWorkspace > [role="tabpanel"]:first-of-type` is intended to make the first tabpanel
  span both columns. CSS `:first-of-type` is evaluated by element type, not by ARIA role; the
  tablist is an earlier `<div>` sibling, so the first tabpanel (`#ward-person-panel-now`) is not
  the first `<div>` of its type. The following rule at line 621,
  `.recordWorkspace > [role="tabpanel"]:not(:first-of-type)`, therefore also matches the Now
  panel and places it in column 2. This contradicts the report's full-width identity/workspace
  claim and changes desktop composition. Use an explicit class or a structural selector tied to the
  known tabpanel position, preserving the existing hidden/tab semantics.

## Retained contracts checked

Patient Search preserves the local typeahead, stage/department filters, refusal handling and
live-region, result-kind branches, preview actions, add-person behavior, and session access record.
Its desktop grid and phone order are source-plausible, with in-flow controls and no new fixed/sticky
owner.

Patient Now preserves the three roving tabs, hidden tabpanels, identity/placement/document facts,
privacy-safe absence text, referral action and pointer note, and print expansion of hidden panels.
No concrete source-only loss or fabricated data path was found beyond the placement selector above.

## Evidence boundary

The six before-source copies are the valid comparison baseline. The earlier HEAD blob mentioned in
the implementation handoff already contained wave-one edits and must not be treated as the
before-task snapshot. This review provides source evidence only; responsive layout, keyboard
behavior, dark/forced-colors appearance, and print output still require the controller's runtime
verification.
