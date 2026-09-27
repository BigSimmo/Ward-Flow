# F14 remaining acceptance checklist r36

Date: 2026-09-13. This supersedes the prioritisation in `F14-remaining-acceptance-r35.md` using the latest controller updates and the subsequent r36 reviews. These are remaining rendered journeys, not claims that source routes are absent.

## Recorded closures

- [x] Officer lower/end evidence: 18 supplied images reviewed clean.
- [x] Legal Forms lower evidence: reviewed clean.
- [x] On-call directory end: six-cell review clean (`F10-on-call-end-review-r35.md`).
- [x] Settings r35 padding finding closed.
- [x] Patient Search accepted; Governance deadline branch and Alerts neutral override wording are closed.
- [x] Governance subtitle: the corrected two-measure subtitle and both effectiveness rows were reviewed at 390 and 1440 in both themes (`F14-hub-governance-closure-r37.md`).
- [x] Discharges Stage wording: post-restart r36 tablet and phone-end captures show whole Stage values, a local table scrollbar, and no document overflow (`F05-discharges-stage-correction-r34.md`).
- [x] Community lower range: the final team rows, provenance/absence panels, operational registers and Go to links were reviewed across the supplied r36 cells (`F05-community-lower-review-r36.md`). Earlier actual Albany-empty and Midland-nine-row switching evidence remains applicable.
- [x] Statistics Overview lower/end and Statistics Compare table/chooser ends were reviewed across all supplied widths and themes (`F05-statistics-overview-lower-r36.md`, `F05-comparison-ward-lower-r36.md`).
- [x] Statistics Ward lower discharge, blocker, referral and long-stay panels were reviewed across all supplied widths and themes (`F05-comparison-ward-lower-r36.md`).
- [x] Handover visible table ends and sign-off/footer controls were reviewed at 390 and 820 in both themes (`F06-handover-lower-review-r36.md`).
- [x] Delays r36 journey: the last open record, WF-329, was selected and showed its recorded voluntary, locked-bed, Tier 3, ED mental-health-owner and placement-requested facts. Resolved today showed seven closures reconciled as six placed and one did not proceed while the waiting count remained 43. The UI has no individual resolved-row interaction to prove.
- [x] Statistics landing/Ward journey: Explore statistics opened, Compare was reached, the SCGH ward link showed 24 beds/19 occupied/2 ready/2 open, and Choose a different ward changed the figures to RPH 20/18/1/1.
- [x] Statistics Compare has no entity-selection control; it exposes chooser links only. The earlier request to change a comparison selection was not an available product journey.
- [x] Statistics Community/Community journey: Midland showed 9/7/0/0, Albany's table link showed 0/0/0/0, and returning to Midland then opening its own page showed nine accepted and seven expected-back records. Combined with the r36 Community lower review, no separate team-switch/lower-range journey remains here.
- [x] Handover r36 journey: Sign off announced explicitly that it is not wired and exposed no held validation form. The whole-network population was 43; the observed ends were Longest waits WF-018, Beds pulled WF-325, In transit WF-327 and the single escalation WF-009.
- [x] Mutation harness: focused 1/1-file, 2/2-test correction passed (`ward-tests-DKiQfU`).
- [x] Typecheck: `run-typecheck-r26.mjs`, session 17268, exit 0 with no diagnostics after the latest TSX.

## Final controller closures

The final changed states have been reviewed and should not be duplicated:

- [x] **Movements:** the corrected resolved labels and list/diagram regions were clean across six r37 cells; the co-run Movements/Hub focused batch passed 35/35 (`F01-movements-resolved-review-r37.md`, `F14-hub-palette-guard-r37.md`).
- [x] **Bed Board:** the corrected daily sheet was clean across six r37 cells, all three real sort choices produced their matching summaries, and the focused Board batch passed 16/16 (`F07-board-visual-closure-r37.md`, `F07-board-order-sheet-correction-r36.md`).
- [x] **Emergency Department:** changing PEEL to ARM updated the populations, both tabs and their record ends were reached, WF-011's urgency form retained required-reason/disabled-record behavior, and the lower action/capacity regions were clean across 12 r37 cells (`F02-ed-lower-closure-r37.md`).
- [x] **Search Hub:** the final Community preview was clean at 390 and 820 in both themes; the real SJGS keyboard-search journey opened the ward route, browser Back returned, and settled Escape restored all 41 results plus search focus (`F14-hub-governance-closure-r37.md`).
- [x] **Governance:** the corrected effectiveness subtitle was clean in all four targeted cells and remained truthful for one unavailable and one reported measure (`F14-hub-governance-closure-r37.md`).

## Remaining browser journeys

None from this bounded acceptance checklist.

- [x] **Handover phone overflow:** ten r37 phone captures show final row 43/WF-018, shifted Pull and LEG columns, local scroll tracks, and the complete footer in both themes (`F06-handover-scroll-closure-r37.md`).

No additional lower screenshot pass remains from this checklist. The documented r36/r37 reports and actual journeys support acceptance with recorded design/behavior deviations; they do not assert that every possible interaction or row was exhaustively captured.

## Evidence boundary

The 34 operational records can now be refreshed from their historical partial notes using the exact current evidence and a `deviates` verdict where behavior-authoritative differences remain. That canonical archival/regeneration is controller-owned. This checklist does not add generic physical-device, hosted, clinical, unavailable-action, or exhaustive-row blockers beyond the written screen Definition of Done.
