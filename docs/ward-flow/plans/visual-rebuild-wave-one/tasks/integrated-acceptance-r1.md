# Wave one integrated acceptance — 2026-09-13

Controller: Astra. This is the current completion checkpoint; earlier task reports preserve historical attempts. Source is local and uncommitted on `codex/task-ward-flow-live-state-20260831`, HEAD `1ef9ed3975078b789e9b5d70b3f000c64edc3809`. Human acceptance is pending. No publication, deployment or provider operation occurred.

## Implemented scope

Mounted header/sidebar and opt-in panel, figure, table and Statistics frame styles; Search hub, Statistics overview, Statistics compare, Command, Delays, Community team and Bed board. Existing engine derivations, provider, reducer, fixtures and clinical action permissions are retained. The roster now includes the previously omitted Statistics compare entry: seven entries in this wave, eighteen tracked overall.

Each task's report records the design/behavior differences. The full shared warning, unavailable shift/pinning/reconciliation statements, real route registry, role controls, search and existing primary actions remain. The Service selection does not pretend to filter the app. The closed rail now retains compact labels and live count badges, with the drawn hover/focus-card surface. Cards show truthful route/count text; drawing-only purpose and breach prose are omitted because the registry has no governed equivalent. Full accessible names remain unchanged.

## Visual evidence

All seven screens have served app/drawing pairs at 390, 820 and 1440 pixels, light and dark. Independent reviewers use Sol medium; the controller uses Astra. Results are recorded in `screen-verification.json`, not inferred from tests. Human design acceptance remains outstanding.

- Hub: `task-2-visual-review-r1.md`, including its revision-2 closure and pilot gate.
- Statistics pair: `task-3-visual-review-r1.md`; accepted `stats-{overview,compare}-r4-*` matrix.
- Command: `task-4-review-r2.md`; `command-r4-*` matrix closes queue-header shrink, unwanted phone pressure and offscreen initial hub.
- Delays: `task-5-review-r1.md`; `delays-r4-*` matrix closes owner-strip wrapping, instruction order and the invalid desktop-dark capture.
- Community: `task-6-review-r1.md`; `community-r4-*` matrix and `community-phone-table-r4.png`.
- Board: `task-7-review-r1.md`; `board-r4-*` matrix with desktop app cells superseded by `board-r5-app-1440-{light,dark}.png`. Additional r5 phone/tablet dark cells confirm selected-detail ordering. The final quiet-filter count changed from five to two after those captures; the predicate correction does not change the layout. Never use the collapsed r4 desktop selected-state images as final evidence.

Captures live under `.superpowers/sdd/2026-09-12-visual-rebuild-wave-one/`. Geometry sidecars record viewport, scale, scroll origin and theme. Invalid earlier captures are superseded, not silently accepted: capturing beyond the viewport distorted Statistics; a responsive rail transition could temporarily measure 916px at desktop; nonzero scroll with a page-origin clip produced blank content. Final matrix capture resets scroll, awaits finite transitions and clips the actual viewport. Below-fold captures use the current document scroll origin.

## Controller interaction and isolation checks

- Reuse the pilot's shared-shell keyboard/search, More pages Escape/focus return, rail, saved appearance/reload, forced-colour focus and print-event evidence. Do not repeat it for each screen.
- Statistics overview: all three native disclosures start closed, open on `beforeprint`, and return closed on `afterprint`. This is event/DOM proof, not a produced PDF. The unchanged `/statistics/ward/rph-adult-secure` frame was sampled at 390/1440 in both themes (`stats-legacy-r1-*`). It retains the legacy light content surface even with a dark shell; it has not been restyled or claimed third-edition complete. Only overview/compare pass the new design prop.
- Command: select WF-014, then RGH Adult Secure. Its eligibility panel changes to the selected ward, Override becomes available, and Refer remains disabled with the existing Moving-stage refusal. No override was submitted. Earlier full queue/candidate/register inspection is retained.
- Delays: owner marking retains all 43 waiting rows; Wards marked 13, Other marked one. The phone strip scrolls to its final Other control (`delays-phone-owner-end-r4.png`). Resolved-today remains a separate closed population; the earlier WF-009 action navigated to its real Command shortlist. WF-014's lower phone detail retains clearance-not-assessed, legal status, source, owner, stage and event-age explanation.
- Community: Change team exposed 63 other live teams; Albany showed a measured empty bed population. Midland's In-bed table retained nine rows and all columns (343px viewport, 720px scroll width). Both printable disclosures opened/restored on print events. Counts are observed demonstration state, not hardcoded invariants.
- Board: all twenty beds remain mounted. Ready hides nineteen, clears an excluded selection and preserves filter focus after Escape; All restores twenty. Arrow Right, End and Home change/focus the three mounted flow panels. Confirmed/Expected switches from one to two beds without conflating the populations. Change ward exposes 23 current units and reaches FSH Adult Secure with the same Bed board shell title. The selected phone detail and subsequent flow panel remain reachable (`board-phone-detail-r4.png`).
- Board print: reproduced Tailwind's base-layer `[hidden]` important rule defeating ordinary print overrides. Scoped important restorations in that same base layer now compute twenty visible bed slots, three block flow panels with a flex ancestor, and a visible daily sheet while print media is active. The screen filter is unchanged after printing. Actual PDF output is unavailable.

## Final review corrections

Independent source review found no P0/P1. Its two P2s were corrected and independently closed: Nobody due out now requires an arrived occupied tile with no expected date, and heading tests retain visibility assertions for persistent and active headings while requiring inactive panels to remain mounted. A dedicated regression checks the quiet count, occupied-only results and each selected record's missing-date text.

Independent visual review caught a selected Board cascade conflict: the old two-class selector put the aside in an implicit third grid column. Matching specificity in the final desktop and narrow rules restores a 773px grid and 352px aside at 1440, and column one/order two on narrow screens. Final closure found no further actionable issue in those cells.

Controller reviewed the shared-shell/frame/primitive changes and changed test contracts alongside the scoped worker reviews. Presentation-only test updates preserve exact populations; new behavior has targeted assertions. No engine/RAG/database file or dependency changed. Existing unrelated checkout changes remain outside this wave.

## Gates

- Pilot: accepted after targeted corrections; exact accounting in `pilot-gate-report-r1.md`.
- Focused batch 1: eleven files handed in, eleven ran; 209 collected, 203 passed, two failed, four pending. Corrected the canonical route import and scoped Waiting-region locator. `focused-batch-r1.md` lists an equivalent file set; its reordered file list is not the original invocation order.
- Focused batch 2: six files handed in, six ran; 146 collected, 143 passed, three failed, all Board presentation assertions. Corrections retain exact day-count multisets, scope Out of service to bed tiles, and separate the grid heading from its count. Exact command and per-file results: `focused-batch-r2.md`.
- Integrated full Ward suite: `node .superpowers/sdd/2026-09-12-visual-rebuild-wave-one/run-integrated-ward.mjs` ran the repository Ward runner under exclusive admission. Its own summary reports **451 files handed in, 451 files ran; 5,121 collected, 5,031 passed, 15 failed, three batches, exits 1/1/1**. JSON reports contain 75 pending tests. Reports: `C:/Users/joshs/AppData/Local/Temp/ward-tests-qYA18Y/report-{0,1,2}.json`. This run failed; a later focused correction pass does not rewrite that result.
- Final focused checks and typecheck: see `final-gate-checkpoint-r1.md`. Screen/Tooltip checks and final seam5/5 passed; mutation harness remains failed. Typecheck now reports only two source-confirmed pre-existing TS2578 comments. No full-suite rerun or green integrated claim.

## Integration correction batch

The failures exposed stale presentation/route/claim/width contracts, two genuine ownership violations (Hub table-cell rules and a Document Viewer print-hook import), canonical colour-alias duplication, and a mutation self-test that left its own temporary anchor on disk. Exact bounded changes and limitations are in `task-8-contract-corrections-sol-r1.md`, `task-8-navigation-claims-corrections-r1.md`, `task-8-layout-guard-corrections-r1.md`, `task-8-guard-corrections-luna-r1.md` and `task-8-hub-seam-corrections-r1.md`. Existing population/refusal assertions remain; the phone-chrome parser now excludes desktop-only width intervals.

Controller deltas: canonical aliases now live on their owning token carrier; `:where` keeps them subordinate to later forced-colour rules. Runtime forced-colour emulation confirms Panel, Filters and RecordRow border/divider/warning roles all resolve to `CanvasText`. Delays selected WF-014 remains styled and complete at desktop dark; phone light remains in flow (`delays-r5-app-*`). Hub now uses WardTable with a compact cell-inset variable applied by the canonical table rule. The initial migration added 28px to the table; restoring its prior inset returns its height to 229.5px. Controller compared `hub-r6-app-1440-light.png` against the accepted pilot and inspected `hub-r6-app-390-dark-table.png` (302px table, no page overflow). Its new Ward-local printable disclosure opens and restores on print events. These are bounded delta checks, not repeated full matrices.

At the earlier forensic checkpoint, the mutation script's only residue was its self-test anchor. The file modification falls inside the failed test's execution interval; a guarded one-line correction restores byte-identical HEAD content. That checkpoint could not establish the child failure. Later diagnostics establish Windows UNKNOWN/open failures at restoration and mutation application; the bounded restoration patch and final failed gate are documented in `final-gate-checkpoint-r1.md`. The earlier `wave-source-fingerprints.json` was sampled **after** that self-test and captured its transient mutant; despite its original label, it must not be treated as a pre-run source freeze. The final working-source fingerprints now supersede it after correction checks; the unreliable old snapshot is retained as `wave-source-fingerprints-pre-correction-unreliable.json`, not accepted as pre-run evidence.

Physical devices, actual PDF generation, hosted behavior and owner visual acceptance are unverified. The remaining eleven tracked screens are outside this first wave. No screen is called finished while its required gates or human acceptance are pending.

## Shared rail closure

`task-1-hover-card-report-r1.md` records the backward-compatible portal Tooltip extension. The controller's drawing comparison also caught missing compact labels and badges; these are now restored at the type floor without changing route names or count derivation. Removing the doubled list/scroll inset keeps words legible. `shell-card-r3-app-1440-{light,dark}.png` supersedes the icon-only r1 and wrapped-label r2 images. The independently inspected references are `shell-card-r1-mockup-1440-{light,dark}.png`; the final light file was recaptured after explicitly checking its theme. Independent closure: `task-1-hover-card-review-r1.md`, no P1/P2 in those four cells.

Controller observed keyboard focus opening the card, Escape removing it, no duplicate accessible description/native title, and viewport clamping through the existing portal. The card is 248px wide with a 10px gap and 2px top offset. Open rail and 820px focus produce no card. Forced-colour mode has a system border and no shadow; print media computes `display: none`. The 390px navigation still wraps with its More pages control (`shell-card-r3-app-390-light.png`). Temporary rail/theme/viewport overrides were restored. Drawing-only state/purpose prose is deliberately absent, so this is design adaptation rather than copied invented content.

## Final checkpoint

`final-gate-checkpoint-r1.md` records exact final commands, results, source-established baseline type errors and the unresolved Windows mutation-harness blocker. Scoped screen implementation can be inspected now; integrated acceptance remains blocked. `wave-source-fingerprints.json` identifies the final uncommitted working source, not the earlier full-run revision.
