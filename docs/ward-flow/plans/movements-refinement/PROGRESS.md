# Q002 — Movements integration checkpoint

13 September 2026. `D:/Worktrees/Database/ward-lead`, branch `codex/task-ward-flow-live-state-20260831`, HEAD `1ef9ed3975078b789e9b5d70b3f000c64edc3809`. Changes remain local and uncommitted over preserved dirty inputs. No publication, provider access, engine-rule change or drawing edit.

## Status

Implemented and source reviewed. Final rendered verification of the corrective delta is **blocked**, not accepted: browser navigation to `http://localhost:3605/mockups/ward-flow/movements` returned `net::ERR_BLOCKED_BY_CLIENT`. No alternate browser or URL bypass was attempted. Canonical Movements verification remains `null`; prior evidence is preserved in `.superpowers/sdd/movements-refinement/screen-verification-before.json`.

## Delivered

- Bounded traffic and worklist scroll bodies; neighbouring summaries remain independently bounded. Desktop summary uses the shared-header offset. Narrow layouts stack panels. This applies the clarified scroll pattern to the two commissioned feedback pages, not a claim of an estate-wide retrofit.
- Consistent Day metric cards, attention cards, compact orthogonal traffic routes, separate accepted/declined register, compact expandable key, rounded row actions and a five-view summary. Transport right now remains.
- Restored individual transport provider, origin, destination, state, elapsed booking time and patient route. Requested and pre-acceptance-cancelled records remain distinct from accepted legs; missing transport records are counted separately.
- Unique ED/ward pairs determine corridor totals and ranked rows, while per-stage breakdown and line facts remain. Same-day declines exclude future records.
- Removed explanatory ordering/footer prose. Operational legal/refusal/absence facts and concise synthetic provenance remain. Resolved summary switches to the actual closed-today population and count.

## Design/behavior deviations

The drawing's completed journeys are not the existing engine's current accepted movements. Labels therefore say Accepted/active corridors, not Carried today. Refusal lines use actual dated decline records and carry no invented journey stage. Unused corridors are omitted because the engine does not calculate that universe. Current engine urgency/order, all-movement worklist with closure markers, frozen closed clocks and actual transport records take precedence over illustrative drawing figures. No new clinical threshold, fabricated owner/contact or transport booking time was introduced. The separate long transport panel is consolidated into the bounded Transport summary without losing its facts.

## Evidence

- M1 implementation report and corrections: [M1](tasks/M1.md).
- Independent source review: [M2](tasks/M2.md), all three P2 findings closed after inspection of the final correction.
- Independent supplied-image review: [M3](tasks/M3-visual.md), no material visual defect in covered responsive light/dark states. No numerical score was invented.
- Screenshots are in `.superpowers/sdd/command-shell-refinement/` (shared evidence directory). Viewed comparisons include `movements-{1440,820,390}-dark.png`, `movements-mock-{390,820}-dark.png`, `movements-mock-1440-dark-final.png`, `movements-1440-light-final.png`, `movements-{820,390}-light.png`, and `movements-mock-{820,390}.png`. Root also inspected `movements-worklist-1440-light.png`; it predates restored Transport details and final labels. Earlier light endpoint overlap was corrected and inspected in dark. These are partial final-state evidence, not blanket acceptance.
- DOM geometry before the final delta confirmed independent traffic viewport (497px body / 1042px content), register (432 / 482), and worklist (704 / 6943) scroll containers. This is containment evidence, not a completed interactive scroll test. Final lower Transport appearance, switcher keyboard behavior and patient navigation still require browser checks. DOM tests cover patient hrefs and facts, not browser navigation.

## Focused checks

Runner: `node .superpowers/sdd/2026-09-12-visual-rebuild-wave-one/run-focused.mjs` followed by explicit files. The runner summary, not its exit code, is the verdict.

1. `tests/ward-movements-screen.dom.test.tsx tests/ward-movements-derivations.test.ts tests/ward-movement-third-edition.dom.test.tsx tests/ward-movement-page-truthfulness.dom.test.tsx tests/ward-movement-drawer-person.test.ts`: **5 handed in / 5 ran; 77 collected, 59 passed, 18 failed**. Restored missing transport details; updated renamed-panel selectors while retaining closure, clocks and route assertions.
2. Corrective two-file run (`ward-movements-screen.dom` and `ward-movement-third-edition.dom`): **2 handed in / 2 ran; 35 collected, 32 passed, 3 failed**. Failures were duplicated summary label, removed prose assertion and stage-row-versus-route count expectation.
3. Corrective `ward-movements-screen.dom` run: **1 handed in / 1 ran; 30 collected, 28 passed, 2 failed**. Narrowed the repeated label lookup and made legal-priority coverage inject an actual expiring authority instead of assuming the default fixture had one.
4. Final `tests/ward-movements-screen.dom.test.tsx`: **1 handed in / 1 ran; 30 collected, 30 passed, 0 failed** (`ward-tests-g1Pz6x/report-0.json`). Other passing files were not rerun unchanged. The added requested-unaccepted regression covers both summary facts and worklist grouping; route-count coverage catches multiple stages on one pair.

M1 separately ran direct Vitest for `tests/ward-movements-corridors.test.ts`: 9/9 passed, including the future-decline guard. That is direct Vitest evidence, not a coordinated Ward-runner result. Controller reiterated the single test-owner rule. No full 5,000-test suite repeated.

`node .superpowers/sdd/2026-09-13-visual-rebuild-full-estate/run-typecheck-r26.mjs`: exit 0, no TypeScript diagnostics, after the final source corrections. Owned files formatted; one transient Prettier file-open error succeeded on a single retry. Final whitespace validation is recorded with the closeout below.

Closeout: scoped `git diff --check` passed. `node scripts/ward-flow/screen-verification.mjs` regenerated **33 of 34 screens looked at, 0 structural problems**; Movements remains the intentionally reopened entry. The other screens' historic records are not new visual proof from this batch.

## Resume without churn

When normal browser access works, load the identified local app, inspect the restored lower Transport panel at desktop/phone, check summary/corridor switches and movement link, and verify inner worklist scrolling leaves its neighbour stationary. Recheck the latest small visual delta against the served drawing at the prescribed widths/themes; reuse unchanged comparisons and successful checks. Only then replace canonical `verified: null` and regenerate the record. Do not restart implementation or repeat full tests.
