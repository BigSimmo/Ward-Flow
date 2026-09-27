# Task 8 seam review — Luna r1

Reviewed the current Task 8 seam corrections and `task-8-hub-seam-corrections-r1.md` source report. No actionable retention or lifecycle issue remains.

- Ward token aliases now live on the composable canonical carrier. The `:where(...)` form brings alias specificity to the same level as the later `.wardTokens.wardTokens` forced-colors rule, so CanvasText overrides remain effective. Delays carries the required `data-ward-page="delays"` marker on its root and the filters/record-row primitive markers remain on the actual elements.
- Hub's `WardTable` keeps the service rows, totals, numeric classes, headings and existing selectors. The shared third-edition cell padding would add roughly 4px per cell and about 28px to this table; Hub's `--ward-table-cell-inset: 0.375rem 0.75rem` restores the accepted compact pilot geometry while retaining the canonical wrapper and border rules.
- The Ward-local printable hook expands only `details.source-print`, removes grouped `name` attributes during print, and restores exact prior `open`/`name` state on `afterprint` and cleanup. Document Viewer disclosures remain outside the selector. No behavior loss was found in the reviewed Hub/Community/Statistics integrations.
- Added four bounded parser controls to `ward-chrome-owner.test.ts`: max 40rem detection, tablet-only 1001–1399px exclusion, 30–50rem intersection detection, and impossible min>max exclusion. The parser intentionally remains limited to the existing flat `px`/`rem` media-query domain; OR clauses and nested media constructs are outside its contract.

No tests, browser checks, server, provider, or hosted operations were run.
