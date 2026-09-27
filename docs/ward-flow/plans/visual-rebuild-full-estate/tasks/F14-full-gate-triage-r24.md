# F14 full-gate triage r24

Read-only classification of `C:\Users\joshs\AppData\Local\Temp\ward-tests-8U7sNh\report-{0,1,2}.json` at the supplied integrated head. The three JSON batches report 579/1916 (40 failed, 44 pending), 565/1899 (22 failed, 29 pending), and 398/1324 (15 failed, 2 pending). Aggregate evidence supplied by the controller is 454 files, 5,139 tests, 4,987 passed, 77 failed, 75 pending. No rerun was made; this is not a pass claim.

## Product or source-contract defects (patch first)

- `ward-network-queue-count.dom.test.tsx` (3): no region named `Priority queue`; `ward-network-referral-placement.dom.test.tsx` (1): no complementary `Explainable shortlist`; `ward-network-stage-filter.dom.test.tsx` (7): no `Priority queue`/`Movement pipeline`, and no controls; `ward-network-stage-strip.dom.test.tsx` (3): no `Movement pipeline`. These are one integration issue: current default is Network overview and the workspace/placement view is not selected in the fixture. Smallest correction is restore the intended default workspace or make each test select it before queue assertions; retain real queue totals, stage filters, placement callbacks, and out-of-pathway explanation. Do not add fake queue data.
- `ward-on-call-screen.dom.test.tsx` (1): synthetic disclosure `<p ... disclosurePanel>` exists but is not visible. Fix the local disclosure visibility/print-open styling while retaining the marker text.
- `ward-text-size-ratchet.test.ts` (1): two actual `--text-3xs/--text-2xs` uses remain in `ward.module.css`; this is a real floor violation, not a selector mismatch.
- `ward-token-layer.test.ts` (4): `--ward-divider` declared 3 times; `--line` has no declaration; `--ink` is not a hex in `ckb-v2-tokens.css`. Repair canonical token ownership/aliases without weakening contrast checks.
- `ward-table-phone-swap.test.ts` (1): `out-of-area-board.tsx` uses a wrapper whose module hides `.tableScroll`, but the rendered wrapper lacks that class. Add the module-owned class to the actual table wrapper, preserving the phone card list.
- `ward-statistics-grid-tracks-fit-the-container.test.ts` (1): five tracks have absolute/bare-var minimums that cannot shrink at raised text size. Convert only those tracks to the existing `minmax(min(<length>, 100%), 1fr)` pattern.
- `ward-provenance-sentences-carry-their-own-marker.test.ts` (1): sentences under the provenance heading do not carry a self-contained synthetic-data marker. Add the marker to each affected sentence, preserving refusal/absence wording.
- `ward-instant-display.test.ts` (1): a new bare `formatInstant` call can assert today without checking day. Use `formatInstantWithDay` or an explicitly justified existing allowlist entry.
- `ward-sidebar-phone-contract.test.ts` (1): listed third-edition shells reserve legacy fixed-phone chrome, including `capacity/bed-map`, handover, legal forms, traffic diagram, on-call, out-of-area, person, and statistics modules. Remove only obsolete reserves or wire the canonical owner; preserve 48px controls and phone dock behavior.

## Stale DOM/fixture or static inventory contracts

- `ward-add-patient.dom.test.tsx` (21): exact `getByLabelText('Record number'|'Given name')` cannot match the rendered required-marker labels. Make the matcher tolerate the required marker or restore an exact accessible name; retain all collision, prefill, gender, refusal, and dispatch assertions.
- `ward-bed-release.dom.test.tsx` (3): `/^Ready \d+/` and `Confirmed 1` no longer match the split/derived bed figures. Update the locator to the rendered figure boundary, preserving the expected-vs-ready arithmetic and submit gating.
- `ward-capacity-absorbed-morning-coverage.dom.test.tsx` (1): expected disclosure phrase `no real hospital` is absent from the current caption, which starts `Where the mismatch is...`. Align the caption/locator while retaining synthetic/non-clinical disclosure.
- `ward-daily-return-rows.dom.test.tsx` (1): no `Expected N` chip for `rph-adult-secure`; inspect the current row’s derived label and update only the boundary, retaining the one arithmetic source.
- `ward-discharge-board.dom.test.tsx` (3): literal excluded count is now embedded after `Outside the four groups`, and current group list has five labels versus expected four. Update containment/order assertions to the rendered structure; retain excluded counts and all groups.
- `ward-ed-psychiatry-hub.dom.test.tsx` (3): three assertions request `listitem`, but current outbox/departments render no listitem roles. Use the current row/table role while preserving outbox subset and no move-clock checks.
- `ward-settings-screen.dom.test.tsx` (1): expected printed handover text is not present on Settings (`What prints on the handover sheet` is rendered). Align the test with the current explicit Settings disclosure, without claiming a print section that is not there.
- `ward-referral-screens.dom.test.tsx` (1): notice ordering assertion sees index 47 rather than `<1`; notices are likely in the current panel/scroll structure. Inspect actual rendered DOM and scope the query to the owning board, preserving both notices and entry data.
- `ward-statistics-claims.test.ts` (1): back-link claim locator is ambiguous because `STATISTICS_HOME_HREF`/its text occurs twice in `statistics-section-frame.tsx`. Make the claim locator unique; retain the route constant assertion.
- `ward-landmarks.test.ts` (2) and `ward-route-component-binding.test.ts` (1): `/ward/[unitId]/answer` adds a real route; inventory counts and pinned rows are one short. Add the explicit dynamic route entry and test coverage.
- `ward-facade-agrees-with-screens.test.ts` (1), `ward-flow-seam.test.ts` (1), and `ward-flow-single-source.test.ts` (1): source scanners report 7 shell route literals, 1 outside-Ward-Flow literal, and 1 unallowlisted `allUnits/unitById` read. Update the route-builder/reference allowlists or move the literal/read to the established owner, after confirming each reported path; do not broad-allowlist.
- `ward-composes-targets.test.ts` (1), `ward-css-token-references-resolve.test.ts` (2), and `ward-design-language-contract.test.ts` (1): token layer is missing `.wardTokens` composition, fallback misses include `--ease`, `--focus-ring` and four more, and `--ward-surface-hover`/`--ward-table-cell-inset` are undeclared. Repair composition/declarations in canonical carriers, not the guards.
- `ward-primitives-shared.test.ts` (1): new `62.5`, `48`, and `80` breakpoints are outside `KNOWN_BREAKPOINTS`; register only the intentional supported breakpoints or use existing values.
- `ward-table-min-width.test.ts` (1): three stylesheet table thresholds are unpinned; add exact file mappings. `ward-table-single-source.test.ts` (2): ED, shell bar, modes, and network modules redeclare canonical table-cell padding/borders; consolidate or document exact intentional backlog entries.
- `ward-shell.dom.test.tsx` (1): shell token is declared three times instead of once; repair ownership, not the assertion.
- `ward-forced-colors-tokens.test.ts` (1): six roles including `--ward-subtle` lack high-contrast handling; add explicit forced-colors mappings.

## Harness/environment classification

- `ward-mutation-harness-reachable.test.ts` (1) reports the harness self-test output lacks `self-test: all guards fire` and instead begins `ok restore retries transient IO...`. This is a harness/Windows execution-path failure until reproduced with the declared command and checked against baseline; do not classify as product-green or silently bypass it. Preserve all three guard checks.

The 35 unique failing files above account for all 77 failed assertions extracted from the three JSON reports. Pending tests (75 aggregate) are not failures and have no inferred reason here. No browser, hosted, provider, server, or physical-device evidence was produced by this triage.
