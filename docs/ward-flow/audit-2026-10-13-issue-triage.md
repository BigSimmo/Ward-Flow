# Ward Flow issue triage by complexity and risk — 13 October 2026

Every issue from the 8 October core-engine review ([`audit-2026-10-08-issue-list.md`](audit-2026-10-08-issue-list.md)), the follow-up honesty and UI audits, and the design and unverified-item lists, re-sorted by **how complex and how risky each fix is**. Synthetic data only. This file records triage; it does not change behaviour.

**Checked against `origin/main` at `30b1803`.** Items fixed by PRs #256 and #257 since the first triage on 11 October are marked fixed and kept for the record. Items marked ✓ were re-read in the code at that commit; the rest carry the evidence level of their source audit. **#267 merged after that commit** and changed `handover-model.ts`, `delays-derivations.ts`, `discharge-board.tsx` and the community intake; re-check any open item in those areas against current `main` before working on it.

**Evidence key.** ✓ confirmed in code at `30b1803`. R reproduced, C code- or script-confirmed, U unverified (in the 8 October list). – from the follow-up audits, not re-checked. **Reproduce every U and – item before fixing it.**

**Corrections to the circulated summary.** The autosave still runs every 30 seconds, not 60 (A2-7, A2-11). The reducer is about 10,200 lines, not about 9,000. A4-5 was an owner decision on 28 September, not a defect. `LiveChip` took a state prop; its callers passed `"live"`.

## Fixed since the first triage

| ID                                 | Issue                                                  | Fixed in                                                                                       |
| ---------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| H01                                | "Live in Hospital" and "Live" search labels and filter | #257 (`a1d7bca`): "In hospital", "On this board"                                               |
| H02                                | Hidden "Live bedflow" text                             | #257: "Active bedflow"                                                                         |
| H03 / R6                           | Shared chip said "Live"                                | #257: chip says "Demo". Residual: see "Live" leftovers in group 1                              |
| H04                                | "Duress beacon active & verified"                      | #257: "not wired in this prototype"                                                            |
| M-ALERTS                           | "Dispatched statewide" toast                           | #257: recorded for the prototype, nothing sent                                                 |
| M-CAPACITY-ACK                     | No row feedback after "Request update"                 | #257 / #258: "Update requested" from the shared record                                         |
| M-THEME                            | Duplicate Appearance control                           | #257: removed; Settings holds the one control                                                  |
| M-DUALSEARCH                       | Page boxes labelled "Search"                           | #258 (`c5577f2`): "Filter"                                                                     |
| Discharges metadata                | "live discharge"                                       | #257                                                                                           |
| R1                                 | Sign-in `<main>` had no `id="main-content"`            | #257 (`96264de`), with test                                                                    |
| R2                                 | 11 dead `homeRegion === "Community"` checks            | #257: one `isCommunityReferral` helper                                                         |
| R3                                 | Visual script pointed at a missing config              | #257: script and doc rows removed                                                              |
| R4                                 | Capacity modal lost focus on close                     | #257                                                                                           |
| R5                                 | Focus fallback on panels without `tabindex`            | #257                                                                                           |
| R8                                 | Route test asserted the not-found stub                 | #257                                                                                           |
| R10                                | `as unknown as WardFlowEvent` cast                     | #257                                                                                           |
| R11                                | 900 lines of PsychSift text in `codebase-index.md`     | #257: moved to `docs/archive/`                                                                 |
| R12                                | Sovereign h1 → h3 skip                                 | #257                                                                                           |
| R13                                | `public/mockup.html` duplicate                         | #257: removed                                                                                  |
| R15                                | Toast animated `all`                                   | #257                                                                                           |
| A1-15                              | Coordinator cockpit dispatched as `ward`               | #256 (`0b1e78c`): cockpit sends the route role. Confirm with a test                            |
| S1-1, S2-1, S1-2, A2-1, A2-2/S2-12 | Five engine bugs                                       | Earlier; 11 regression tests in `tests/ward-review-2026-10-08-fixes.test.ts` (not re-run here) |

**Partly fixed.** A1-1, A1-3, S2-11: #256 added `wardActingUnitRefusal` to `ACCEPT_REFERRAL` and `DECLINE_REFERRAL`. It refuses a ward only when the screen names a different acting ward. A ward event with no `actingUnitId` still passes, and `PULL_PATIENT`, `ACCEPT_IN_PRINCIPLE` and `DECLINE` have no check. See group 5.

## 1. Quick and low risk

Text, markup, config or docs, with no engine logic. Most touch one file; A4-5, M-STATUS/M-HOSTING/U11 and M-DEAD span several files (named in each row) and M-DEAD also needs the deletion check.

| ID                              | Fix                                                                                                                                      | Evidence |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| A4-5 comments                   | Correct the stale `DeveloperAreaGate` comments in `src/proxy.ts` and `src/app/mockups/layout.tsx`; the gate was removed on 28 September  | ✓        |
| "Live" leftovers                | `settings-panes.tsx` "Live" option and Sovereign "Live" tab: align with "Demo" or confirm they mean update mode                          | ✓        |
| ClinicalRail comment            | Correct comments that still describe `ClinicalRail` as mounted                                                                           | –        |
| R7                              | Add `background_color` to `src/app/manifest.ts`                                                                                          | ✓        |
| R9                              | Add sign-in to the landmark test                                                                                                         | –        |
| R14                             | Stop `prefetch={false}` leaking onto test anchors                                                                                        | –        |
| Touch target                    | Lift the 36px "New referral" sibling to the repo's 48px                                                                                  | –        |
| M-WARD-ANSWER                   | Explain or hide the disabled "Accept in principle (waitlist)" button                                                                     | –        |
| D7                              | Helper line saying why "Refer to selected wards" is disabled                                                                             | –        |
| Home footer                     | "…device0 refused" concatenation. Not found at `30b1803`; close if it does not reproduce                                                 | –        |
| M-STATUS, M-HOSTING, U11        | Reconcile stale commits, deployment claims and test counts in `STATUS.md`, `hosting.md` and docs                                         | –        |
| M-DEAD, stale Postgres fixtures | Delete `ward-chrome-header.tsx`, `governance-screen.tsx` and unused fixtures. Check references and run `check:dead-code-candidate` first | –        |

## 2. Contained, moderate risk

One area each, needs a test. No reducer changes.

| ID                             | Fix                                                                                                                                          | Evidence |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| S2-14                          | Offer Withdraw only where the reducer allows it                                                                                              | C        |
| S2-15                          | Record the alert stand-down against the role that acted                                                                                      | C        |
| A3-2, A3-10                    | Handover: in-vehicle patients shown as expired pulls; held beds dropped after a stopped transport. Reported worse                            | U        |
| A3-3, A3-5                     | "Nowhere eligible" lists patients with a bed; accepted patients vanish from search                                                           | U        |
| A3-8, A3-9                     | Withdrawn referrals vanish from the board; false "declined by all"                                                                           | U        |
| A3-1, A3-13, A3-14, A3-15      | Capacity: pulled patients double-counted, stuck "not settled" banner, boxes above bed count, day-rule mismatch                               | U        |
| A3-4, A3-6, A3-7, A3-11, A3-12 | Delays and statistics: wrong delay class, waitlist counted as decline, ward-silent clock, false inactivity, revoked exam routed to Transport | U        |
| A1-4, A1-6                     | Audit loses the legal continuation code and the walk-in patient                                                                              | R        |
| A1-11, A1-12                   | Audit mislabels first expiry as extension; cross-ward refusal as "transition"                                                                | U        |
| A2-4                           | Null times from storage raise false legal-due alerts                                                                                         | C        |
| A2-6, A2-7                     | Failed save rolls back silently; "Clear session" undone by the 30-second autosave                                                            | U        |
| A2-10, A2-15                   | "Since last look" survives reset; reload after midnight fails. #256 touched `since-last-look.ts`, so re-check                                | U        |
| A2-8                           | Backend returns 503 not 409 on racing first saves; mocks expect 412. Local backend test only                                                 | U        |
| A2-11, A2-12, A2-13            | Autosave every 30 seconds with no change; BroadcastChannel per dispatch; validator re-declares constants                                     | U        |
| A4-1, A4-2, A4-10              | Synthetic-data guard misses identifier formats and numbers; "Copy diagnostics" can copy identifiers                                          | C / U    |
| A4-9, A4-11                    | Logger redaction and key collision (logger unused)                                                                                           | C / U    |
| A4-12, A4-14, A4-15            | CSRF header gap, digest route relies on the proxy, fail-open webhook stub                                                                    | U        |
| A4-13                          | Dev server on the LAN; local check trusts `Host`                                                                                             | U        |
| A4-6                           | Routes ending in an image extension skip CSP and the mockup block. Medium: changes the security-header matcher                               | U        |
| A4-7                           | `public/*.html` mockups indexable; two load unpinned CDN scripts. Remove or block                                                            | U        |

## 3. Engine fixes, contained but in the reducer

Medium risk: pinned tests. Write the failing test first.

| ID    | Fix                                                                                           | Evidence |
| ----- | --------------------------------------------------------------------------------------------- | -------- |
| S2-3  | Arrival into a full ward later shows a phantom free bed                                       | R        |
| S2-5  | Arrival details accepted on closed movements; false "arriving late"                           | R        |
| S2-7  | Release-and-reopen reports a bed release that never happened                                  | R        |
| S2-13 | Transfer-out advances the discharge revision twice                                            | R        |
| S2-6  | Repatriation from an ended stay stalls at arrival                                             | R        |
| S1-3  | Walk-in community referral drops the patient link                                             | R        |
| S1-6  | Overrides recorded for wards that needed none                                                 | R        |
| S1-8  | Re-pull keeps the old hold expiry                                                             | R        |
| S1-12 | Ward event without a ward id changes another ward's discharge projection                      | R        |
| A1-7  | A ward's own referral logged as from a community team                                         | U        |
| A1-9  | Remove `ward` and `community` from `RECORD_MOVEMENT_MEDICAL_CLEARANCE`; check sending screens | ✓        |

## 4. Cross-cutting, high complexity

| Group                   | IDs and fix                                                                                                                    | Evidence |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Shared close helper     | S1-4, S2-4, S1-5, S1-7: closures that skip notices, leave wards listed or leave waitlist entries                               | R / C    |
| Tighter load validator  | A2-5, A2-3; also makes the type-only S1-9, S1-10, S1-11, S1-13 and S2-8 unreachable                                            | C / R    |
| Eligibility             | S2-9: the security gate means different things on the referral and direct-admission paths. Changes who can be placed where     | C        |
| Synthetic-data guard    | A4-4: call the guard on live save paths before any shared save. A2-9: route the cloud vault through the same guards when wired | U        |
| Clock                   | A2-14: delete or align the unused `WardFlowClockProvider`                                                                      | U        |
| Design-system migration | M-TOKENS, `WardKindChip`/`WardSegmented` adoption, D8 (60 raw tables), D2 (`transition: all`). Low behaviour risk, many files  | –        |
| Naming hygiene          | `clinical-dashboard` paths, `clinical-kb-theme-change` event, duplicate `WardBar`. Renames across the tree                     | –        |
| Reducer split           | `ward-flow-reducer.ts` is about 10,200 lines. Highest risk; do not do it as clean-up                                           | ✓        |

## 5. Owner decision before any code

| ID                                                 | Decision needed                                                                                                                                                                               | Evidence  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| S2-2                                               | Revoked-exam hold can be lifted by clearing the blocker. Option (a) count bed-holding stages, or (b) refuse edits to an "awaiting release" blocker. Two pinned tests conflict with either fix | R         |
| A1-1, A1-3, S2-11                                  | Partly fixed (soft check, accept and decline only). Decide whether to require `actingUnitId` from every ward caller and extend it to `PULL_PATIENT`, `ACCEPT_IN_PRINCIPLE` and `DECLINE`      | ✓ partial |
| A1-8, A1-10, S2-10, A1-13, A1-14                   | Same ward-scope pattern for arrival details, "no transport needed", transport booking, alert acknowledgement and referral corrections                                                         | R / U     |
| A1-2                                               | Who counts as the referrer for withdrawal                                                                                                                                                     | R         |
| A1-5                                               | `RECORD_LEGAL_FORM_WRITTEN` still allows `ward` and `community`. Who may change a legal form expiry, and is it audited                                                                        | ✓         |
| S1-14                                              | `ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS = 24`; its own comment quotes ruling FD-19 as 48. Introduced as 24 in #157. Which figure is right                                                     | ✓         |
| A4-3                                               | Server-side identifier check in the backend, or keep it unexposed until there is one                                                                                                          | U         |
| A4-5                                               | `/mockups/ward-flow` is public by your 28 September decision. Confirm it stays public (then only the comments in group 1 change)                                                              | ✓         |
| A4-8                                               | Whether tenant-wide backend mode may accept guest accounts and any client app                                                                                                                 | U         |
| M-DELAYS-HOLD, M-DISCHARGE-NW, "Record a decision" | Now honestly labelled "(not wired)" by #257 and #256. Decide: wire, keep labelled, or remove                                                                                                  | –         |
| M-QUEUE                                            | #256 pinned act-now then longest wait (D-32). Confirm whether ATS and "Flagged urgent" still need separating                                                                                  | –         |
| M-DUALREF                                          | Competing "New referral" controls. Current `main` is the design baseline                                                                                                                      | –         |
| D1, D3, D5, D6, D9                                 | Animations, grid height floors, manifest screenshots, axe and visual baselines in CI (new dependency), deleting superseded mockups                                                            | –         |
| D4                                                 | Offline app-shell cache; must not break storage rule D-18                                                                                                                                     | –         |
| Defaults                                           | Discharges opening on "All" (#256 changed its filters; re-check) and the empty placement hub                                                                                                  | –         |

## 6. Investigate first, outside access, or drop

**Investigate in a browser before fixing.** Compact-screen queue squashing; transport officer screen chrome; Delays not filtered by top-bar search; Discharges default view; Metro % mismatch (#252 relabelled occupancy, re-check); blank placement hub; "Urgent" saturation on the referral board; Ward page button clutter (#252 folded actions into More, re-check). Also U1–U7 and U9.

**Needs provider access or someone else's work.** U8 (Railway deployment state), U10 (IRAP, Entra ID and WA Health Azure tenant assumptions), A4-8 testing (Azure), U12 (another session's unmerged local branch). Each needs the owner's explicit go-ahead.

**Drop.**

- Pre-push `SKIP_IN_FLIGHT_CI_GUARD=1` default: an approved exemption in `AGENTS.md` (Prototype Operating Mode, item 3).
- M-CONTACTS: labelling contacts as not call-tested is correct.
- The UX audit's 10 findings: they describe PsychSift, not Ward Flow.
- The refuted false alarms in the source audits.

## 7. Added after the honesty pass (13 October 2026, `f01f216`)

Items from the 8 October audit and the 6 October visual review that groups 1 to 6 did not list, plus what PRs #258 and #270 settled. Checked against `origin/main` at `f01f216` by reading the source. No tests, lint or build were run.

**Settled by #258 and #270.** Capacity "Update requested" now reads the shared request record and re-enables after the ward confirms (M-CAPACITY-ACK). The record preview says "On this board now" or "Not on this board now" and follows the search row (no open movement and no queued referral means Past). The Community "How to reach" label reads "Published, not call-tested" (M-CONTACTS, labelling only). The Movements box is "Find" and the Referrals box is "Filter".

| ID              | Issue                                                                                                                                                                                                                                                                                        | Group           |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| CAP-REV         | Capacity request ordering relies on minute timestamps. Other bed events (for example `PULL_PATIENT`) also stamp `confirmedAt` and can clear an outstanding request early. Record the allocatable revision on each request; this changes the persisted shape                                  | 5 (owner)       |
| SPEC-005        | Home queue ordering policy, and the "Flagged urgent" mark beside the ATS marks (M-QUEUE)                                                                                                                                                                                                     | 5 (owner)       |
| M-DEAD          | Retired `ward-chrome-header` module still on disk; needs `check:dead-code-candidate` and the owner's approval                                                                                                                                                                                | 1 (owner gate)  |
| M-TOKENS        | Local `.btnPrimary` is still defined in five CSS modules                                                                                                                                                                                                                                     | 4               |
| M-CODEMAP       | `code-map/shell-and-shared.md` says "All 42 routes". `src/app/mockups/ward-flow` has 50 page entry points (plus sign-in). Eight are unmapped: `/command`, `reports/chronology`, `reports/downtime`, Statistics `eds`, `services`, `teams`, `wards`, `weekly`. Needs a route-by-route refresh | 1               |
| M-TESTTRUTH     | The audit saw the Cloud `check:ward-expected-reds` check fail at its tip (eight environment and boundary files). Not re-run since                                                                                                                                                            | 6 (investigate) |
| M-NOTWALKED     | Routes the audit never walked: `/people/[patientId]`, `/hub`, `/people/new`, `/mockups/ward-flow-digest`, `/sovereign`                                                                                                                                                                       | 6 (investigate) |
| M-STATS-SAMPLES | Statistics with Samples switched on may read as real. Deferred by the audit; not re-measured                                                                                                                                                                                                 | 6 (investigate) |
| D-LATER         | Design "Later" items, not defects: sign-in shows seven role previews, Community lists 64 teams, Statistics is not on the morning path                                                                                                                                                        | 5 (owner)       |
| REMAINING-39    | 39 backend, governance and clinical tasks (16 partial, 14 owner decisions, 8 external verification, 1 deferred) in `reports/remediation-remaining-tasks-2026-10-08.md`: BE-001 to BE-011, operations, GOV-001 to GOV-003, cultural, legal, TGA and catchment phone checks                    | 5 and 6         |
| HOSTED-UNPROVEN | Whether Railway runs the current `main` is unproven; `docs/hosting.md` says settings were not rechecked                                                                                                                                                                                      | 6 (provider)    |
