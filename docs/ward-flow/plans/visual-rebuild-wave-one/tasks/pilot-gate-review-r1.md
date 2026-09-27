# Pilot gate review (bounded)

Reviewed `tasks/pilot-gate-report-r1.md`, the current diffs of `tests/ward-hub-screen.dom.test.tsx` and `tests/ward-shell-print-ancestor.test.ts`, and the print addition in `src/components/ward-management/shell/ward-rail.module.css`. No tests, browser, server, or source edits were performed.

## Findings

- The rail print reset reaches the actual portalled Sheet content. `ward-rail.tsx` passes `contentClassName={styles.moreSheet}` to `Sheet`; `Sheet` applies that class to its panel and renders the panel through `OverlayPortal`. The `@media print` rule `.moreSheet, .moreSheet *` therefore covers the panel and its body/list descendants outside the ward shell subtree, with `!important` color and background declarations.
- `tests/ward-shell-print-ancestor.test.ts` records the rail as a portalling file and checks the real `.moreSheet *` reset plus both neutralized properties. The sidebar coverage remains separately intact.
- The Hub capacity correction preserves the two-capacity behavior. It scopes the query to the selected ward's `Beds` detail section, asserts the distinct ready and not-yet-cleared figures and labels, and rejects their collapsed sum. The section also contains the ward's total-bed cell, so this assertion remains a targeted check rather than a whole-page phrase/count match.

No concrete issue found in the reviewed corrections. The report's runtime claims are accepted only as recorded evidence from the controller; this review adds no new execution or visual evidence.
