# Screens B: board, capacity, movements, delays, handover, patients and the rest

## Current remediation seams — 8 October 2026

The original map below preserves historical counts and locations. Current local changes
wire the expected-discharge editor to the existing guarded `UPDATE_EXPECTED_DISCHARGE`
action, including cancel-without-mutation and reopen-after-save evidence. This is CAP-001
in the user's approved audit remediation scope; D-19's earlier “Move the date is left off”
remains recorded as the prior prototype choice, not rewritten as an original defect.
Unspecified intervention/forecasting contracts are not invented. Ward allocation actions
open the actual movement-specific placement review rather than an unwired Allocate button.
Bed map preparation markers remain visible when observed offered counts disagree;
arrival discrepancies are explicitly recorded and do not manufacture surge beds.
See [the current receipt](../reports/remediation-2026-10-08.md).

Covers every file under `src/components/ward-management/` in these folders: `alerts/`, `board/`,
`capacity/`, `delays/` (no `backup/` subfolder exists there — see "Not checked"), `discharges/`,
`escalation/`, `governance/`, `handover/`, `hub/`, `legal-forms/`, `movements/`, `officer/`,
`on-call/`, `out-of-area/`, `patients/`, `settings/`, `sovereign/`, `tools/`, `tracker/`, `wards/`.
Tip `ace8e9ee8d` (one commit behind this worktree's HEAD `d9016539bd`, which only split this doc
into linked parts — no source under these folders changed between the two). Date 25 September 2026. Line counts are `wc -l` run once per folder against every file in it. Route/importer/test
claims come from `grep -rl` across `src/app`, `src/components` and `tests`, cross-checked against
the generated `docs/ward-flow/SCREEN-MAP.md` and against `tests/ward-component-reachability.test.ts`,
which independently computes the same import graph. Back to
[the code map index](README.md).

## `alerts/`

Review repair, 3 October 2026 (PR #27): overdue chips preserve day/hour/minute components from the recorded duration. Each tier tab includes its visible label in its accessible name, retaining the extended tier wording and count. Provider-backed duration and accessible-name regressions live in `ward-alerts-sovereign-features.dom.test.tsx`.

**Route:** `/alerts`. **Mockup:** `alerts-third-edition.html` (`docs/ward-flow/SCREEN-MAP.md`, "34
with a build contract"). **Dispatches:** `ACKNOWLEDGE_INBOX_ITEM`, `DISPATCH_BROADCAST_ALERT`,
`STAND_DOWN_BROADCAST_ALERT`. **Reads:** `buildActionInbox`, `isOpen` (`ward-derivations.ts`).
**Tests:** `ward-alerts-*` (five files), plus repo-wide guards `ward-broadcast-alerts.dom.test.tsx`,
`ward-dialog-accessibility.dom.test.tsx`, `ward-landmarks.test.ts`, `ward-nav.test.ts`,
`ward-no-dead-ends.dom.test.tsx`, `ward-primitives-shared.test.ts`, `ward-reanchor.test.ts`.
`ward-broadcast-banner.tsx` (in `shell/`) and `ward-flow-events.ts` also import this folder.

- **`src/components/ward-management/alerts/alerts-screen.tsx`** (1495 lines) — the Alerts screen:
  action inbox plus the broadcast-alert composer/stand-down flow. Main export `AlertsScreen`
  (line 374); everything above it is local helpers and constants for grouping and filtering the
  inbox.
- **`src/components/ward-management/alerts/alerts.module.css`** (1794 lines) — this screen's styles.
- **`src/components/ward-management/alerts/ward-broadcast-model.ts`** (177 lines) — pure model for
  network-wide broadcast alerts: `BroadcastSeverity`, `BroadcastCategory`, `BroadcastTargetScope`,
  `BroadcastAlert`, the template library `WA_BROADCAST_TEMPLATES`, and `isAlertActive` /
  `getActiveBroadcastAlert` / `formatTimeRemaining`. Also imported by `shell/ward-broadcast-banner.tsx`,
  which is how a dispatched alert reaches every screen, not only this one.

## `board/`

**Route:** `/board/[unitId]`. **Mockup:** `bed-board-third-edition.html`. **Dispatches:**
`BLOCK_BED_RELEASE`, `END_LEAVE_BED`, `PATIENT_ARRIVED`, `RECORD_AWAY_AT_EMERGENCY_DEPARTMENT`,
`RECORD_LEAVE_BED`, `RECORD_LEAVING`, `RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT`, `RELEASE_BED`,
`SET_DISCHARGE_BARRIER`, `SET_STEP_DOWN_CANDIDATE`. **Reads:** `unitCapacity`
(`ward-derivations.ts`) plus this folder's own tile/occupant builders. **Tests:** the two-dozen
`ward-board-*`, `ward-daily-sheet*`, `ward-advanced-features.dom.test.tsx`,
`ward-builder-2-features.dom.test.tsx`, `ward-dialog-accessibility.dom.test.tsx`,
`ward-flow-provider-server-determinism.test.ts`, `ward-flow-single-source.test.ts`, plus the
repo-wide guards.

- **`src/components/ward-management/board/ward-board.tsx`** (3629 lines) — the per-ward bed board:
  every bed as a tile, filters, outgoing/incoming/since-shift-start tabs, block-release and leave-bed
  dialogs. Outline: local helpers `findUnit` (170), `buildTiles` (224), `expectedInstant`/
  `daysUntilExpected` (338/353), `buildOccupants` (380), `expectedPhrase`/`movesPhrase` (423/441),
  `outgoingToday` (506), `buildIncoming` (559), `bedGonePhrase`/`tileDomId` (601/609),
  `PersonEntry` component (623); the screen itself, `export function WardBoard({ unitId })`, starts
  at 878 and runs to end of file — dialogs, focus traps, keyboard handling and the tile grid are all
  inline in that one function rather than split into sub-components.
- **`src/components/ward-management/board/board.module.css`** (4847 lines) — styles for both
  `ward-board.tsx` and `ward-daily-sheet.tsx`.
- **`src/components/ward-management/board/ward-bed-board.tsx`** (2 lines) — `export * from
"./ward-board"` plus `WardBoard` re-exported as `WardBedBoard` and as the default export. ⚠️
  **UNREACHABLE.** `docs/ward-flow/SCREEN-MAP.md`'s generated check lists it under "a screen
  component nothing imports"; the live route (`board/[unitId]/page.tsx`) imports `WardBoard`
  directly from `ward-board.tsx`, never through this shim.
- **`src/components/ward-management/board/ward-daily-sheet.tsx`** (603 lines) — the printable daily
  sheet embedded in the board (who came in, who is going, who is 1:1). Exports
  `dailySheetGroups`, `asAtStamp`, and the `WardDailySheet` component.

## `capacity/`

**Capacity review update — 7 October 2026:** Summary shortcuts use native buttons and move
keyboard focus to the ward table after applying highlights. Summary service counts exclude
empty groups; the locked-ready summary no longer claims an unsupported 1:1 figure or HDU
designation. Ward-table counts and highlight counts follow the selected service, including
empty services. A ResizeObserver measures compact-table overflow and shows a sideways-scroll
cue only when details extend beyond the visible width. Regression coverage is in
`tests/ward-capacity-review.dom.test.tsx`.

The follow-up visual polish uses the same components and state: bed-map toggles and service
shortcuts now have compact, inset selected surfaces and count badges; desktop buttons are 30px
high, with 44px targets on touch devices. The toggle groups sit together instead of occupying
opposite edges of an empty row. Capacity metric groups have a bounded width, and nested card
surfaces use translucent fills, subtle inner highlights and diffuse shadows. Dark-mode,
forced-colour and print fallbacks remain token-based.
Service shortcut feedback uses current section bounds rather than only the latest observer
batch, so a preceding service's visible trailing edge cannot replace the service just selected.

**Route:** `/capacity`. **Mockup:** `capacity-third-edition.html` (MERGE 02, folding a former
`morning` route into this one — see the header comment in `capacity-derivations.ts`). **Dispatches:**
`REQUEST_CAPACITY_REFRESH`. **Reads:** `unitCapacity`, `wardServiceOrder`, `isOpen`,
`BED_RELEASE_BLOCKED_FIGURE_LABEL`, `bedReleaseStateLabels` (`ward-derivations.ts`), plus this
folder's own `capacity-derivations.ts`. **Tests:** the dozen-plus `ward-capacity-*` files,
`ward-agent2-stress-test.test.ts`, `ward-bed-release.dom.test.tsx`,
`ward-facade-agrees-with-screens.test.ts`, `ward-mono-face-earns-its-place.test.ts`,
`ward-refinement-discharge-ui.dom.test.tsx`, `ward-service-capacity-tracker.test.ts`, plus
repo-wide guards.

- **`src/components/ward-management/capacity/capacity-screen.tsx`** (1699 lines) — the merged
  Capacity screen: readiness table, network fold, bed-kind gap analysis, per-ward sidebar drilldown.
  Outline: `CapacityScreen` (72), `ReadyNowSection` (674), `GapWord`/`GapRow` (793/804),
  `NetworkRow` (864), `NetworkServiceGroupRows` (1213), `CapacityTabs` (1324),
  `CapacityWardSidebar` (1369), `DischargeRecordFacts` (1635, renders discharge-record facts inline
  on the ward sidebar rather than linking to `discharges/`).
- **`src/components/ward-management/capacity/capacity.module.css`** (1896 lines) — styles for
  `capacity-screen.tsx`.
- **`src/components/ward-management/capacity/bed-map.tsx`** (363 lines) — the network's whole bed
  supply as one square per bed, grouped by health service. Exports `bedMapWards`,
  `groupBedMapWardsByService`, `BedMap`. Header comment: every count is read from an existing
  derivation, never recounted. Imports `WardBoard`'s home folder (`board/`) only for types, not
  components.
- **`src/components/ward-management/capacity/bed-map.module.css`** (374 lines) — styles for
  `bed-map.tsx`.
- **`src/components/ward-management/capacity/capacity-derivations.ts`** (599 lines) — the pure
  supply-vs-demand logic behind the screen: `bedKindGaps`, `bedKindTotals`, `networkWardRows`,
  `freeingCellText`, `countCellText`, `releasesBeyondToday`, `networkTotals`,
  `groupNetworkWardRowsByService`, `networkServiceGroupTotals`. Header comment: deliberately
  aggregate-only — "answers WHERE IS THE MISMATCH, never WHERE COULD THIS PERSON GO"; never
  imports `ward-eligibility.ts`.
- **`src/components/ward-management/capacity/bed-meeting-derivations.ts`** (added 4 October 2026) —
  `bedMeetingSheet`, the one-page morning bed-meeting summary: capacity, expected discharges, people
  waiting in ED and the top delays. Re-derives nothing: it narrows `networkWardRows`,
  `groupDischarges`, `edOpenSummaries` and `delayGroups` to the chosen service and caps each list.
- **`src/components/ward-management/capacity/bed-meeting-sheet.tsx`** and its `.module.css` — the
  "Bed-meeting sheet" button on Capacity, its preview dialog and the sheet-only A4 print rules.
  Tested by `tests/ward-bed-meeting-sheet.dom.test.tsx`.
- **`src/components/ward-management/capacity/beds-forecast.ts`** — smart feature 10, tomorrow's
  beds: `bedsForecast` (24 and 48 hour estimates from beds ready now, confirmed and expected
  discharges, minus people still needing a bed, with a low/likely/high range), `forecastFigureText`
  and `BEDS_FORECAST_LIMITS`. Pure, so the morning bed-meeting sheet can reuse it. Rendered by
  **`beds-forecast-panel.tsx`** (styles in `beds-forecast.module.css`) on the Capacity screen.
  **Tests:** `tests/ward-beds-forecast.test.ts` and the forecast block in
  `tests/ward-capacity-screen.dom.test.tsx`.
- **`src/components/ward-management/capacity/service-capacity-tracker.ts`** (602 lines) — WA-wide
  compound escalation tracking: `deriveBedCapacityTone`, `deriveEdWarning`,
  `evaluateCompoundEscalation`, `trackServiceBedCapacity`, plus the `CapacityAlertCode`
  (`green`/`yellow`/`red`/`black`) type and the `StatewideCapacityReport` shape.

## `delays/`

**Route:** `/delays` (also the landing point for `/queue`, `/exceptions` and `/escalation`
redirects — see `delays-alias.ts` and the `escalation/` entry below). **Mockup:**
the approved Delays page mockup (October 2026, built live in October 2026; earlier
`delays-third-edition.html`). **Dispatches:** `RECORD_ESCALATION` from `delays-screen.tsx`
(Escalate to State bed coordination desk in the person's panel); everything else reads and presents. **Reads:**
its own `delays-derivations.ts`, plus `ward-derivations.ts` selectors via the shared
`ward-service-scope-bar`/`ward-service-store`. **Tests:** the dozen `ward-delays-*` files,
`ward-bar-zero-is-reachable.test.ts`, `ward-facade-agrees-with-screens.test.ts`,
`ward-flow-queue-selection.dom.test.tsx`, `ward-movements-screen.dom.test.tsx`,
`ward-sidebar.dom.test.tsx`, plus repo-wide guards. It is also imported by
`coordinator/coordinator-screen.tsx` and `movements/movements-screen.tsx` (cross-screen
figures/links), and by `ward-nav-counts.ts` and `ward-service-scope.ts`.

- **`src/components/ward-management/delays/delays-alias.ts`** (25 lines) — Wave 4 item 15 pedagogy:
  `DELAYS_ALIAS_FROM` (`"queue" | "exceptions" | "escalation"`), `parseDelaysAliasFrom`,
  `delaysAliasBannerCopy`. Backs the banner shown when a visitor lands on `/delays` via one of the
  three old bookmarks.
- **`src/components/ward-management/delays/delays-derivations.ts`** (589 lines) — pure logic:
  `DelayCause` union and `DELAY_CAUSE_ORDER`/`DELAY_CAUSE_COPY`, `SEVERE_CAUSES`, `DelayOwnerId` and
  `DELAY_OWNERS`, `ownerOf`, `delayGroups`, `legalDeadlineMinutes`. A comment flags a past defect:
  an earlier plan imported `Instant` from `ward-model` instead of `ward-clock`, a type error Vitest
  (no typecheck) never caught — a live pitfall pattern for this codebase.
- **`src/components/ward-management/delays/delays-screen.tsx`** — the data scope (chosen
  service), the old-bookmark banner, the Q-12 Attention population (severe causes network-wide plus
  urgent movements outside the service), the one write (`RECORD_ESCALATION`) and the page shell.
  Renders `DelaysBoard`. `SYSTEMIC_HOLDS` stays empty until a hold can be recorded.
- **`src/components/ward-management/delays/delays-board.tsx`**, **`delays-board-parts.tsx`** and
  **`delays-board.module.css`** — the approved Delays page mockup, built live: hero counts that
  filter (Over 8h, Over 24h, due within the urgent warning, past recorded time), four "whose move"
  tiles, the Waiting table grouped by blocker (or Longest wait, with recorded legal times pinned)
  with a timeline under the open row, and a rail holding the Escalated / Attention / Resolved /
  System registers plus Longest quiet, which becomes the person's panel when a row is open (a sheet
  below 64rem). The person's panel lists their wards (accepted, declined, asked) and then
  Candidate wards: every other ward from `shortlistCandidates`, eligible or overridable with the
  reason, never cut to a count, plus a disclosure for wards no reason can buy. Filters narrow the table and it always states how many are hidden, with "Show
  everyone" (owner ruling D-38, 9 October 2026, superseding the 2026-09-07 highlight rule here).
  Below 40rem each row becomes a card.
- **`src/components/ward-management/delays/delays-board-graphs.tsx`** — the three graphs under the
  table: Wait spread (dots by whose move or catchment, linear to 24h then compressed to 7d), Next 4
  hours (half-hour runway of who crosses 8h or 24h and which recorded legal times fall due, with
  the over-8h projection) and Where and whose move (catchment by owner or blocker). Each narrows
  the same table; a dot opens that person's row.
- **`src/components/ward-management/delays/delays-board-model.ts`** — pure board derivations over
  `delayGroups`: rows with wait, quiet time and recorded legal time, 8/12/24h bands, owner tiles,
  catchments, filters, runway bins and projection, ward summaries, candidate wards and row events. Tested by
  `tests/ward-delays-board-model.test.ts`.
- **`src/components/ward-management/delays/delays-view-model.ts`** — pure origin counts,
  radar precedence/intervals/outliers and common linear timeline geometry. All durations use minutes.
  The board uses its `CatchmentOrigin` type and `overTwelveHoursMinutes`; the radar and timeline
  helpers served the old Delays views (`delays-data-views.tsx`, `delays-coordination.tsx`), deleted
  on 9 October 2026 (D-38), and are now reached only by `tests/ward-delays-view-model.test.ts`.
  Exact window-end records stay in the final interval; longer waits are never clamped onto the axis.
- **`src/components/ward-management/delays/delays.module.css`** (5406 lines) — the largest CSS
  module in this map; styles for `delays-screen.tsx`.

## `discharges/`

**Route:** `/discharges`. **Mockup:** `discharges-third-edition.html`. **Dispatches:** none
found in this folder directly; discharge actions (`SET_DISCHARGE_BARRIER`, `RELEASE_BED`, etc.)
live on `board/`, which owns bed release. **Reads:** `bedReleaseStateLabels`
(`ward-derivations.ts`), `RELEASE_BANDS`/`releaseBand` (`ward-bed-availability.ts`). **Tests:**
`ward-discharge-blocked-emphasis.dom.test.tsx`, `ward-discharge-board-plan-departure-and-kpi.dom.test.tsx`,
`ward-discharge-board.dom.test.tsx`, `ward-discharge-column-contract.dom.test.tsx`,
`ward-refinement-discharge-ui.dom.test.tsx`, plus repo-wide guards.

- **`src/components/ward-management/discharges/discharge-board.tsx`** (1444 lines) — the discharge
  ledger: exports `DischargeGroups` type, `groupDischarges` (114), the `DischargeBoard` screen
  (253), and `DischargeGroupSection` (1284). Under the 1,500-line threshold so no forced outline,
  but note it is close to it.
- **`src/components/ward-management/discharges/discharges-third-edition.module.css`** (1033 lines)
  — third-edition styles, imported alongside the plain module below.
- **`src/components/ward-management/discharges/discharges.module.css`** (468 lines) — base styles;
  `discharge-board.tsx` imports both CSS modules together.

## `escalation/`

**Route:** none live. `/escalation` (`src/app/mockups/ward-flow/escalation/page.tsx`) is a
`redirect()` to `/mockups/ward-flow/delays?from=escalation` — MERGE 01, owner-approved 2026-09-05.
**Mockup:** none listed for this folder in `SCREEN-MAP.md`; the escalation board's design now lives
inside `delays-third-edition.html`. **Dispatches:** none. **Reads:** none live (the component is
unreached). **Tests:** `ward-component-reachability.test.ts` (declares it unreachable, see below),
`ward-device-claim-reason.dom.test.tsx`, `ward-escalation.dom.test.tsx` — these two still render
`EscalationBoard` directly, so they report green about a screen no coordinator can open.

- **`src/components/ward-management/escalation/escalation-board.tsx`** (180 lines) — the retired
  escalation board component. ⚠️ **UNREACHABLE**, declared in both
  `tests/ward-component-reachability.test.ts` (`DECLARED_UNREACHABLE`, reason "`/escalation`
  redirects to `/delays`") and the generated `docs/ward-flow/SCREEN-MAP.md` ("UNREACHABLE — a screen
  component nothing imports"). Still imported by two test files (above), which is exactly the
  situation the reachability guard exists to keep visible rather than silently wrong.
- **`src/components/ward-management/escalation/escalation.module.css`** (191 lines) — styles for the
  unreachable component; not deleted alongside it (see `docs/agents/dead-code-deletion.md` — removal
  is a separate, owner-governed decision).

## `governance/`

**Route:** `/governance` exists and has a build contract in `SCREEN-MAP.md`
(`governance-third-edition.html`), but the route does **not** render this folder's component. ⚠️
**`governance/page.tsx` mounts `WardModeWorkspace mode="governance"`, which renders `GovernanceView`
from `ward-management-modes.tsx`, which in turn renders `GovernanceWorkbench` from
`ward-management/governance-registers` — an entirely different, unrelated component tree** (covered
in [Frame and PsychSift](frame-and-psychsift.md) or [Routes, shell and shared UI](shell-and-shared.md),
not this file). **Dispatches:** none. **Reads:** none live. **Tests:** only
`ward-browser-build-css.test.ts`, and that test only compiles `governance.module.css` through the
build pipeline — it does not render or import `governance-screen.tsx` itself.

- **`src/components/ward-management/governance/governance-screen.tsx`** (236 lines) — a retired,
  second-edition governance screen. ⚠️ **UNREACHABLE AND UNTESTED — not even caught by the
  reachability guard**, because `tests/ward-component-reachability.test.ts` only declares orphans
  that some _test_ still renders, and no test renders this one. Confirmed independently: it is on
  the generated `SCREEN-MAP.md` "UNREACHABLE" list, and a repo-wide grep for `governance-screen` or
  `GovernanceScreen` outside this file finds nothing. Its own imports are a second clue: it pulls in
  `GovernanceWorkbench` (the same component the real route now renders directly) and
  `../ward-modes-second-edition.module.css` — a second-edition stylesheet — confirming this is the
  file the third-edition shell replaced without deleting.
- **`src/components/ward-management/governance/governance.module.css`** (1115 lines) — styles for
  the unreachable screen above; only reachable transitively through dead code.

## `handover/`

**Route:** `/handover`. **Mockup:** `handover-third-edition.html`. **Dispatches:**
`RECORD_HANDOVER_SIGN_OFF`. **Reads:** `COMMUNITY_TEAM_PAGES`/`communityTeamById`
(`community/community-derivations.ts`), `elapsedLabel`, `handoverSnapshot`, `isOpen`,
`referralForMovement`, `stageCopy` (`ward-derivations.ts`), `openWorkBeforeShiftEnd` and friends
(`ward-board-time-features.ts`). **Tests:** the dozen `ward-handover*` files plus
`ward-advanced-features.dom.test.tsx`, `ward-community-durations-not-dates.test.ts`,
`ward-drawing-match-r2-12.test.ts`, `ward-pull-vocabulary.dom.test.tsx`,
`ward-screen-handover-link.dom.test.tsx`, `ward-service-scope.test.ts`,
`ward-settings-screen.dom.test.tsx`, plus repo-wide guards. Also imported by
`ward/ward-screen.tsx` (a handover link/summary on the ward screen).

- **`src/components/ward-management/handover/handover-page.tsx`** (3537 lines) — the morning/evening
  handover sheet: scope selection, sign-off, urgent-outside-scope filtering, longest waits, pulled
  beds, in-transit, placement problems. Outline: pure helpers `isHealthService`/`handoverScopeValue`/
  `parseHandoverScope`/`handoverScopeLabel` (70–104), `movementTouchesUnit`/`movementInHandoverScope`
  (111–132), `movementObservationLabel`/`handoverCompletionDue` (144/151),
  `recordHandoverSignOff` (164), `movementIsUrgent`/`urgentMovementsOutsideScope` (179/186),
  `getHighRiskFlags` (208), `KNOWN_MOVEMENT_PERSONAS` (254), `resolveMovementPatient` (292); the
  screen `HandoverPage` (318) runs to ~3070, then five more exported sections —
  `HandoverScopeControl` (3071), `UrgentOutsideFilterFooter` (3134), `LongestWaitsSection` (3214),
  `PulledBedsSection` (3262), `InTransitSection` (3304), `PlacementGoneWrongSection` (3353),
  `OriginDepartmentCell` (3405), `OpenBeforeShiftEndSection` (3422), `SignOffSection` (3472) —
  are broken out as separately exported components, unlike most other 1,500+-line screens in this
  map which keep everything inline in one function.
- **`src/components/ward-management/handover/handover-third-edition.module.css`** (2287 lines) —
  third-edition styles.
- **`src/components/ward-management/handover/handover.module.css`** (412 lines) — base styles;
  both CSS modules are imported together by `handover-page.tsx`.

## `hub/`

**Route:** `/hub`. **Mockup:** `search-hub-third-edition.html`. **Dispatches:** none — read-only
search/preview screen. **Reads:** its own `hub-derivations.ts`, plus
`COMMUNITY_TEAM_PAGES`, `unitCapacity`, `wardServiceOrder`, `bedsPendingPreparation`. **Tests:**
`viewport-fill-contract.test.ts`, `ward-hub-*` (five files), plus repo-wide guards.

- **`src/components/ward-management/hub/hub-browser-memory.ts`** (142 lines) — per-viewer
  `localStorage` memory for pinned and recently-opened hub entries (`usePinnedHubIds`,
  `useRecentHubIds`, `toggleHubPin`, `recordHubVisit`; `HUB_PIN_LIMIT = 8`, `HUB_RECENT_LIMIT = 5`).
  Header comment is explicit: only ward/ED/community-region **ids** are ever stored, never anything
  about a patient.
- **`src/components/ward-management/hub/hub-derivations.ts`** (419 lines) — the hub's pure search
  logic: `HubKind`/`HubEntry` types, `hubEntries`, `searchHub`, `hubCounts`, `readyByService`,
  `AttentionRow`/`needsAttention`, `networkBeds`, `unauthorisedWards`, `groupedResults`. Renders
  nothing itself; every figure is read from an existing derivation, never recomputed.
- **`src/components/ward-management/hub/hub-provenance.ts`** (87 lines) — `hubReconciliationLine`,
  the hub's "Invented figures, reconciled/do not reconcile, no event feed" sentence, copied
  verbatim from the mockup's own wording rather than composed. Handles a `problems: number | null`
  distinction deliberately — `null` means "nothing was reconciled" (the check array does not exist
  yet under `src/`), which a plain `0` could not express (see the file's own long comment on the
  2026-09-11 defect this fixed).
- **`src/components/ward-management/hub/hub-screen.tsx`** (999 lines) — the search hub screen
  itself, `HubScreen` (140).
- **`src/components/ward-management/hub/hub.module.css`** (1238 lines) — styles for `hub-screen.tsx`.

## `legal-forms/`

**Route:** `/legal-forms`. **Mockup:** `legal-forms-third-edition.html`. **Dispatches:**
`RECORD_LEGAL_FORM_RECEIVED`, `RECORD_LEGAL_FORM_WRITTEN`. **Reads:** `elapsedLabel`, `isOpen`
(`ward-derivations.ts`), plus its own `legal-forms-derivations.ts`. **Tests:**
`ward-audit-legal-recorded-time.dom.test.tsx`, `ward-legal-form-due-at-capture.test.ts`,
`ward-legal-forms-derivations.test.ts`, `ward-legal-forms-not-wired-and-register.dom.test.tsx`,
`ward-legal-forms-screen.dom.test.tsx`, plus repo-wide guards.

- **`src/components/ward-management/legal-forms/legal-forms-derivations.ts`** (269 lines) — pure
  logic: `legalFormPopulation`, `legalFormHasClockConcept`, `legalFormGroupOf`/`legalFormGroupRows`,
  `isLegalDeadlineBreached`, `legalFormOrdered`, `legalDeadlineText`, `legalFormBreakdown`,
  `legalFormRowClassification`. Header comment: the screen computes no populations, sort order or
  wording of its own — matches the discipline `movements-screen.tsx` names for itself.
- **`src/components/ward-management/legal-forms/legal-forms-screen.tsx`** (1492 lines) — the Mental
  Health Act paperwork screen (received/written forms, deadline tracking). `LegalFormsScreen` at
  115; under the 1,500-line threshold, no forced outline.
- **`src/components/ward-management/legal-forms/legal-forms.module.css`** (1678 lines) — styles.

## `movements/`

**Route:** `/movements` (MERGE 03, folding a former `movements` and `transport` screen — see
`movements-derivations.ts` header) and `/movements/[movementId]` (the patient movement workspace,
renders `WardMovementNotFound`/`WardPatientWorkspace` from `ward-management-console.tsx`, not a
component in this folder — `/movements/[movementId]` is on `SCREEN-MAP.md`'s "ROUTE WITH NO
MOCKUP" list). **Mockup:** `movement-third-edition.html`; `movement-gantt-third-edition.html` is
drawn but has no build contract (backs `movement-horizon-gantt.tsx`). **Dispatches:**
`CLEAR_MOVEMENT_URGENT_FLAG`, `FLAG_MOVEMENT_URGENT`. **Reads:** `isOpen`, `referralForMovement`,
`stageCopy`, `transportLeg` (`ward-derivations.ts`), `SEVERE_CAUSES`/`delayGroups`
(`delays/delays-derivations.ts`). **Tests:** twenty-plus `ward-movement*`/`ward-flow-clock*` files,
`ward-back-sync-and-focus-trap.dom.test.tsx`, `ward-checks-publication.dom.test.tsx`,
`ward-component-reachability.test.ts`, `ward-delays-third-edition.dom.test.tsx`,
`ward-facade-agrees-with-screens.test.ts`, `ward-refinement-interactions.dom.test.tsx`,
`ward-transport-page-name.test.ts`, `ward-urgent-flag.dom.test.tsx`, plus repo-wide guards.

- **`src/components/ward-management/movements/movement-drawer.tsx`** (421 lines) — the movement
  detail side drawer. Exports `personLine` (114) and `MovementDrawer` (138).
- **`src/components/ward-management/movements/movement-horizon-gantt.tsx`** (651 lines) — the
  48-hour horizon Gantt visual. Exports `MovementHorizonGanttProps`, `HorizonDensity`
  (`"compact" | "expanded"`), `DENSITY_CONFIG`, and the `MovementHorizonGantt` component (101).
- **`src/components/ward-management/movements/movement-horizon.module.css`** (899 lines) — styles
  for the Gantt component.
- **`src/components/ward-management/movements/movements-derivations.ts`** (956 lines) — the merged
  screen's pure logic. Header comment states the fold explicitly: `journeyStages` answers "what
  stage has this placement reached" (replacing the old `MovementsView`),
  `transportLegs`/`transportCounts` answer "where has the vehicle got to" (replacing
  `tracker/live-tracker.tsx`) — both borrow `stageCopy`/`transportLeg` rather than re-deriving them.
  Also exports `totalsReconciliation`, `reconciliationSentence`, `corridorCounts`,
  `refusedCorridorCounts`, `waitedMinutes`, `byLongestWait`, and the horizon-lane builder
  `deriveMovementHorizonLanes` (900) with its `MovementHorizonEvent`/`MovementHorizonLane` types and
  `CANONICAL_48H_PROJECTIONS` fixture.
- **`src/components/ward-management/movements/movements-screen.tsx`** (1734 lines) — the merged
  Movements/Transport screen. Outline: `MovementsScreen` (254), `DayMetric` (1284), `StageRow`
  (1312), `TransportRow` (1614), `UnacceptedTransportRow` (1634), `NoTransportRecordRow` (1663),
  `ShapeMovementList` (1694). Header comment repeats the same "THE SCREEN COMPUTES NOTHING BEYOND
  PRESENTATION" discipline `legal-forms-derivations.ts` cites.
- **`src/components/ward-management/movements/movements.module.css`** (2400 lines) — styles for
  `movements-screen.tsx`.
- **`src/components/ward-management/movements/traffic-diagram.tsx`** (411 lines) — a standalone
  corridor-traffic visual, `TrafficDiagram` (27). ⚠️ Declared in
  `tests/ward-component-reachability.test.ts`'s `DECLARED_UNREACHABLE` list ("standalone movements
  visual component; tested directly in `ward-movements-traffic-diagram.dom.test.tsx`") — not reached
  from any route today, but exercised by a direct unit/DOM test rather than a screen.
- **`src/components/ward-management/movements/traffic-diagram.module.css`** (429 lines) — styles for
  the diagram above.

## `officer/`

**Route:** `/transport/officer`. **Mockup:** `transport-officer-third-edition.html`. Header
comment on the test list and `ward-nav.ts` both describe this as "the same patients... a different
person doing four things on a phone" — deliberately not folded into `movements/` the way
`tracker/live-tracker.tsx` was, because it must work one-handed. **Dispatches:** `PATIENT_ARRIVED`,
`PATIENT_COLLECTED`, `RECORD_DIVERSION`, `TRANSPORT_ACCEPTED`, `TRANSPORT_EN_ROUTE`. **Reads:**
`ward-derivations.ts`, `ward-absence-labels.ts`, `ward-board-time-features.ts`,
`ward-change-reasons.ts`. **Tests:** `ward-advanced-features.dom.test.tsx`,
`ward-back-sync-and-focus-trap.dom.test.tsx`, `ward-builder-2-features.dom.test.tsx`,
`ward-diversion-controls.dom.test.tsx`, `ward-governance-enumerations.dom.test.tsx`,
`ward-management-role.dom.test.tsx`, `ward-management-role.test.ts`,
`ward-officer-blocked-reason-parity.test.ts`, `ward-officer-kpi-and-copy.dom.test.tsx`,
`ward-officer-print.test.ts`, `ward-officer-stepper.dom.test.tsx`,
`ward-print-ink-specificity.test.ts`, `ward-withdraw-acceptance-refusal.test.ts`, plus repo-wide
guards.

- **`src/components/ward-management/officer/officer-screen.tsx`** (1212 lines) — the one-handed
  phone transport-officer flow: accept, en route, collected, arrived, or divert. Exports
  `acceptedBlockedReason` (94), `enRouteBlockedReason` (108), `collectedBlockedReason` (131), plus
  the `OfficerScreen` component. Under the 1,500-line threshold, no forced outline.
- **`src/components/ward-management/officer/officer.module.css`** (1384 lines) — styles.

## `on-call/`

Print-preview follow-up to PR #26, 3 October 2026: print CSS reveals coverage/handover rows for every displayed role and hides the interactive disclosure/favourite controls. Screen selection stays unchanged when returning from print. The on-call print case in `ui-ward-roles.spec.ts` checks the actual print-media visibility, recorded verification wording and restored screen expansion in Chromium.

**Route:** `/on-call`. **Mockup:** `on-call-third-edition.html`. **Dispatches:**
`RECORD_ESCALATION`. **Reads:** its own `on-call-roster.ts`; no imports from `ward-derivations.ts`.
**Tests:** `ward-on-call-holds-no-people.test.ts`, `ward-on-call-screen.dom.test.tsx`, plus
repo-wide guards.

- **`src/components/ward-management/on-call/on-call-roster.ts`** (109 lines) — `OnCallRole` (three
  fields: `id`, `role`, `shift` — no name/phone/pager/email field exists, deliberately),
  `NETWORK_ON_CALL_ROLES`, `SERVICE_ON_CALL_ROLES` (per `HealthService`; `WACHS` is an empty array
  on purpose), `servicesWithNoRoleRecorded`, `roleRecordCounts`. Extensive header comment: this
  screen exists to be dialled under pressure, so it holds role labels and shift windows only, never
  a real or placeholder contact method — stricter than its own mockup, which shows a placeholder
  extension. `tests/ward-on-call-holds-no-people.test.ts` pins the `OnCallRole` key set so a future
  edit cannot quietly add `name`/`phone`/`pager`/`email`.
- **`src/components/ward-management/on-call/on-call-screen.tsx`** (850 lines) — the on-call roster
  screen, `OnCallScreen` (88).
- **`src/components/ward-management/on-call/on-call.module.css`** (1138 lines) — styles.

## `out-of-area/`

**Route:** `/out-of-area`. **Mockup:** `out-of-area-third-edition.html`. Header comment: "Phase 8,
Task 5 (spec D8-3): the out-of-area ledger — how many people are currently in a bed a long way from
where they live, and for how long." **Dispatches:** `RECORD_REPATRIATION`. **Reads:**
`ward-admissions.ts`, `ward-distance.ts`, `ward-referrals.ts`, `ward-flow-events.ts`. **Tests:**
`ward-flow-single-source.test.ts`, `ward-out-of-area-figure-direction.dom.test.tsx`,
`ward-out-of-area-live-state.dom.test.tsx`, `ward-out-of-area-upgrade.dom.test.tsx`,
`ward-print-ink-specificity.test.ts`, `ward-referral-screens.dom.test.tsx`, plus repo-wide guards.

- **`src/components/ward-management/out-of-area/out-of-area-board.tsx`** (950 lines) — the ledger
  screen itself.
- **`src/components/ward-management/out-of-area/out-of-area-third-edition.module.css`** (1018
  lines) — third-edition styles.
- **`src/components/ward-management/out-of-area/out-of-area.module.css`** (546 lines) — base
  styles; both CSS modules are imported together.

## `patients/`

**9 October 2026 gate board, second pass (D-38):** `patient-mode.ts` adds On leave (the stay has a
leave bed), Absent without leave (that held bed records `absentWithoutLeave`) and On a CTO (the
patient record holds `communityTreatmentOrder`). The status card gains a missing person checklist
for absences; `patient-now-cards.tsx` adds the leave and Last seen cards. The record tabs in
`patient-dossier-tabs.tsx` (with `patient-record-tabs.module.css`, alongside the older module it
still reuses for search, filters, episodes and documents) now follow the mockup: History opens with
a pattern strip and a recorded-events timeline for this presentation; Community has Care team, a
dashed Family and carers Preview, and a Community plan that records or ends a CTO; Details has a
not-recorded count and a dashed "Not in the record yet" card; Documents has a forms register on the
shared wf table with no lapse column. Interpreter language and Aboriginal status stay in separate
Details groups, never beside the Now history (placement rule in `person-screen.tsx`).

**9 October 2026 gate board:** the Patient page follows the chosen "Gate board" mockup.
`patient-mode.ts` derives the mode from the resolver order (open movement by stage, then occupied
bed, otherwise not active): Finding a bed, Bed held, In transit, On ward, Not active. On leave,
absent without leave and CTO are not derived: the record has no field for them yet, and adding one
needs the owner's OK. `patient-status-card.tsx` (and CSS module) builds the status card: verdict, a
gates-clear meter in placement modes, and three cells that each name an owner and carry at most one
action; the first gate not clear holds the primary. `patient-now-cards.tsx` (and CSS module)
supplies Why they're here, Legal now (recorded times only, no lapse times, D5) and Who to call.
`patient-flight-header.tsx` takes a mode pill and a `quiet` light hero for Not active records.
Now shows the status card, then `patient-transit-operations.tsx` (with `showMetrics={false}`, the
card already states those facts), the transport booking record and arrival plan in held and transit
modes, and the context cards. The old gate card, Next step card, facts strip, Live journey rail and
Clinical overview switch are gone, so `patient-clinical-summary.tsx` and `patient-tracker-facts.tsx`
are no longer rendered by Patient Now. The status card does not read where else a patient has
stayed (D-14).

**5 October 2026 compact redesign:** `patient-flight-header.tsx` accepts local action controls;
Patient Now supplies clinical/document/details shortcuts with keyboard focus handoffs. Header,
tracker and tab styles use a joined compact layout. Community provides a care directory and
follow-up summary; Details includes a native recorded-field meter. Shared reducer and records
remain the source of truth. Dossier DOM tests cover live and inactive header shortcuts.

**4 October 2026 tab refinement:** `patient-dossier-tabs.tsx` and its CSS module provide searchable
History, care-linked Community, grouped Details and authority/document-ledger panes.
`patient-clinical-summary.tsx` provides the Now clinical overview; `patient-tracker-facts.tsx` and
its CSS module provide persistent reservation, transport and clearance context. Explicit clinical
clearance recording and workflow focus handoffs stay in Patient Now / transit operations.
`tests/ward-patient-dossier-tabs.dom.test.tsx` covers the new filters, metadata, clipboard and
clearance/focus behaviour; `scripts/ward-flow/capture-patient-dossier-tabs.mjs` captures every tab,
live/inactive records, filters and dialogs at desktop, tablet and mobile sizes with axe checks.

**4 October 2026 visual refinement:** `patient-flight-header.tsx` supplies the compact curved
identity band; `patient-record-overview.tsx` and its CSS module supply the record-only hub. Live
status comes from movement closure/stage state. Open movements default to transit operations;
closed/arrived movements and record-only patients have explicit inactive rail labels.

**4 October 2026 update:** Patient Now also hosts `patient-transit-operations.tsx` and its CSS
module. The local Clinical overview / Transit operations switch preserves the five dossier tabs.
Legacy `/movements/[movementId]` renders the same `PatientNowScreen`; cockpit exception handlers
are reused via `MovementWorkspaceCockpit`'s embedded mode. Operational dispatches, event-name
mappings, verification commands and screenshot capture are documented in
[the unified flight deck implementation note](../plans/unified-patient-flight-deck.md).
`tests/ward-patient-flight-deck.dom.test.tsx` drives referral through arrival and verifies
reasoned step-back / release capacity behaviour against the shared reducer.

**Routes:** `/people/new` (renders `AddPatientForm` from `add-patient.tsx`) and
`/people/[patientId]` (renders `PatientNowScreen` from `patient-now-screen.tsx` by default, or
`PersonScreen` from `person-screen.tsx` when the URL carries `?view=governed` or `?view=legacy` —
`people/[patientId]/page.tsx` picks between them explicitly). **Mockups:**
`add-a-patient-third-edition.html` → `/people/new`; `patient-now-third-edition.html` →
`/people/[patientId]`. **Dispatches:** `ADD_PATIENT`, `BOOK_TRANSPORT`. **Reads:** `stageCopy`,
`transportLeg` (`ward-derivations.ts`), plus `patient-now-adapter.ts`/`patient-now-records.ts` for
the rich-scenario path. **Tests:** `guard-push.test.ts`, `ward-add-patient.dom.test.tsx`,
`ward-advanced-features.dom.test.tsx`, `ward-builder-2-features.dom.test.tsx`,
`ward-flow-single-source.test.ts`, `ward-patient-identity-integrity.test.ts`,
`ward-patient-now-screen.dom.test.tsx`, `ward-patient-now.dom.test.tsx`,
`ward-patient-placement-fields.dom.test.tsx`, `ward-patient-sensitive-adjacency-css.test.ts`,
`ward-patient-transport-section.dom.test.tsx`, `ward-patient-typed-text-not-in-url.dom.test.tsx`,
`ward-person-screen.dom.test.tsx`, `ward-referral-destinations.dom.test.tsx`, plus repo-wide guards.

- **`src/components/ward-management/patients/add-patient.module.css`** (1245 lines) — styles for
  `add-patient.tsx`.
- **`src/components/ward-management/patients/add-patient.tsx`** (991 lines) — the add-a-patient
  front-door form. Exports `AddPatientForm`.
- **`src/components/ward-management/patients/patient-now-adapter.ts`** (635 lines) — resolves a
  `PatientId`/`MovementId` to a `ResolvedPatientNow` (record, live movement, admission), bridging
  `patient-now-records.ts`'s fixture data with live reducer state. Overloaded
  `resolvePatientNowRecord` (24, 32, 41).
- **`src/components/ward-management/patients/patient-now-records.ts`** (638 lines) — synthetic rich
  clinical scenario data for the two demonstrated patients (WF-009 "Stuck", WF-004 "Moving well"),
  authored from `docs/ward-flow/mockups/patient-now-original-third-edition.html`. Exports
  `ClinicalGate`, `ContactCard`, `NextStepItem`, `HistoricalPresentation`, `CommunityTeamRecord`,
  `DocumentRecord`, `PatientNowRecord`, `PATIENT_NOW_RECORDS`, `dur`, `clock`, `fillTemplate`. All
  patient data here is synthetic, not real.
- **`src/components/ward-management/patients/patient-now-screen.tsx`** (1690 lines) — the rich
  "Patient Now" workspace. Single exported component `PatientNowScreen` (130) with no top-level
  sub-components broken out — the whole 1,560-line body is one function.
- **`src/components/ward-management/patients/patient-now.module.css`** (2276 lines) — styles for
  `patient-now-screen.tsx`.
- **`src/components/ward-management/patients/person-screen.tsx`** (510 lines) — the governed/legacy
  patient view (reached via `?view=governed`/`?view=legacy`). Exports `Fact` (109) and `PersonScreen`
  (189).
- **`src/components/ward-management/patients/person.module.css`** (820 lines) — styles for
  `person-screen.tsx`.

## `settings/`

**Route:** `/settings`. **Mockup:** `settings-third-edition.html`. **Dispatches:**
`SET_CONFIGURATION`. **Reads:** `ward-configuration.ts`, `ward-legal-forms.ts`, `ward-panel.tsx`,
plus this folder's own `settings-search-index.ts`/`settings-thresholds.ts`. **Tests:**
`ward-browser-build-css.test.ts`, `ward-settings-appearance.dom.test.tsx`,
`ward-settings-configuration.dom.test.tsx`, `ward-settings-not-wired-controls.dom.test.tsx`,
`ward-settings-rail.dom.test.tsx`, `ward-settings-screen.dom.test.tsx`,
`ward-settings-thresholds.test.ts`, plus repo-wide guards.

- **`src/components/ward-management/settings/operator-switcher-modal.tsx`** (640 lines) — Switch
  workstation, direction D (9 Oct 2026): the shared `Drawer` with search, recents, the patient in
  focus (coordinator route only, owner answer 38), the desk you are on, the statewide desks, then
  every hospital with its ED and wards and the community teams. A click expands a desk in place
  with its figures and what its role can do; Open desk navigates to that role's home. Styles in
  `workstation-switcher.module.css`. Exports `OperatorSwitcherModal`.
- **`src/components/ward-management/settings/workstation-desks.ts`** (225 lines) — the desks the
  drawer lists, built from `hubEntries` and `edHomeSummaries` (never a fixed list), the current
  desk from the route, and each role's actions from `EVENT_ROLE`. Test:
  `ward-workstation-desks.test.ts`.
- **`src/components/ward-management/settings/settings-screen.tsx`** (1898 lines) — the settings
  console. Single exported component `SettingsScreen` (178); local constants
  `THRESHOLD_STATE_WORDS`, `APPEARANCE_CHOICES`, `ROLE_PERMISSIONS` sit above it, but no
  sub-components are broken out — like `patient-now-screen.tsx`, the ~1,700-line body is one
  function.
- **`src/components/ward-management/settings/settings-search-index.ts`** (259 lines) — declarative
  search index for the settings console, modelled after PsychSift's own `settings-sections.ts`.
  Exports `SettingsDomainId`, `SettingsDomain`, `SETTINGS_DOMAINS`, `SettingsSearchEntry`,
  `SETTINGS_SEARCH_ENTRIES`, `filterSettingEntries`, `countMatchesByDomain`.
- **`src/components/ward-management/settings/settings-thresholds.ts`** (105 lines) — the single
  table of every numeric threshold in the prototype that changes a screen's colour without saying so
  on the screen itself. Owner-ruled 2026-09-12: no threshold is added here without an owner's name
  against it. Exports `ThresholdState`, `PublishedThreshold`, `publishedThresholds`.
- **`src/components/ward-management/settings/settings.module.css`** (2032 lines) — styles for
  `settings-screen.tsx`.

## `sovereign/`

**Route:** `/sovereign`. **Mockup:** `sovereign-chrome-and-drawers-perfected.html` — listed under
"Drawn, no build contract" in `SCREEN-MAP.md`, but the route does exist and does render this
component (the "no build contract" heading there means no generator-enforced pairing test, not that
the route is missing). **Dispatches:** none. **Reads:** none from `ward-derivations.ts`. **Tests:**
`ward-landmarks.test.ts`, `ward-nav.test.ts`, `ward-no-dead-ends.dom.test.tsx` only — no
sovereign-specific test file exists.

- **`src/components/ward-management/sovereign/sovereign-showcase-screen.tsx`** (163 lines) — a
  showcase/demo screen for the "sovereign" chrome and drawers concept. `SovereignShowcaseScreen`
  (30). Also imported by `src/app/mockups/ward-flow/sovereign/error.tsx` and `loading.tsx`.
- **`src/components/ward-management/sovereign/sovereign-showcase.module.css`** (185 lines) —
  styles.

## `tools/`

**Not a route.** Both components here are opened as drawers from the global top bar
(`shell/ward-bar.tsx`, around its "Catchment resolver" and "MHA deadline calculator" tools
sections), reachable from every ward screen rather than mounted by any one `page.tsx`. **Mockup:**
none in `SCREEN-MAP.md` — these are chrome, not a drawn screen. **Dispatches:** none. **Reads:**
`ward-catchment.ts` (resolver) and `ward-flow-provider.tsx` (calculator, for the live clock).
**Tests:** `ward-catchment-resolver.dom.test.tsx`, `ward-mha-calculator.test.ts`.

- **`src/components/ward-management/tools/ward-catchment-resolver.module.css`** (525 lines) —
  styles for the resolver.
- **`src/components/ward-management/tools/ward-catchment-resolver.tsx`** (1027 lines) — WA
  catchment-area lookup tool (which service/site covers a given postcode/suburb). Imports
  `ward-catchment.ts` and `ward-service-colors.ts`. `WardCatchmentResolver` is the component
  mounted by `ward-bar.tsx`.
- **`src/components/ward-management/tools/ward-mha-calculator.module.css`** (354 lines) — styles for
  the calculator.
- **`src/components/ward-management/tools/ward-mha-calculator.tsx`** (758 lines) — Mental Health Act
  2014 deadline calculator. Per the repo-wide rule (`AGENTS.md` "Mental Health Act wording"), it
  must never compute or display a real statutory time limit; check this file first if that rule is
  ever suspected broken. `WardMhaCalculator` is the component mounted by `ward-bar.tsx`.

## `tracker/`

**Route:** none live. `/transport` (`src/app/mockups/ward-flow/transport/page.tsx`) redirects to
`/mockups/ward-flow/movements` — MERGE 03, owner-approved 2026-09-05, folding the live vehicle
tracker into `MovementsScreen`. **Mockup:** none current. **Dispatches:** none. **Reads:**
`transportLeg` (`ward-derivations.ts`) only, via its own `tracker-derivations.ts`. **Tests:**
`tracker-derivations.test.ts` (tests the derivations module directly — legitimate unit-test
coverage of logic, not a screen), `ward-component-reachability.test.ts`,
`ward-tracker-leg-badge.dom.test.tsx`, `ward-transport-page-name.test.ts`.

- **`src/components/ward-management/tracker/live-tracker.module.css`** (303 lines) — styles for the
  unreachable screen below.
- **`src/components/ward-management/tracker/live-tracker.tsx`** (170 lines) — the pre-merge live
  vehicle tracker screen. ⚠️ **UNREACHABLE**, declared in
  `tests/ward-component-reachability.test.ts` ("`/transport` redirects to `/movements`"). Still
  passes `activeMode="transport"` to `ClinicalRail`, which is the one thing keeping it from being a
  clean deletion candidate — `ward-nav.ts` notes explicitly that retiring this file and
  `tracker-derivations.ts` is "a two-file question, not an id rename," left for the owner.
- **`src/components/ward-management/tracker/tracker-derivations.ts`** (66 lines) — small, pure
  helpers used by `live-tracker.tsx` and legitimately unit-tested on their own:
  `trackerRowState`, `stampAgeText`. Delegates all "which leg" logic to `transportLeg`
  (`ward-derivations.ts`) rather than duplicating it.

## `wards/`

**Route:** `/wards`. **Mockup:** `wards-third-edition.html`. **Dispatches:** none — a directory/
index screen. **Reads:** `unitCapacity`, `wardServiceOrder` (`ward-derivations.ts`),
`bedsPendingPreparation` (`ward-bed-availability.ts`), `unitHasLockedBeds`/`unitHasOpenBeds`
(`ward-bed-designation.ts`). **Tests:** `ward-flow-service-coverage.test.ts`,
`ward-management-print-coverage.test.ts`, `ward-register-inpatient-form-codes.test.ts`,
`ward-screen-overview-and-entry.dom.test.tsx` (imports `WardIndex` from here alongside `WardScreen`
from the separate `ward/` folder — the two are easy to conflate by name), plus repo-wide guards.

- **`src/components/ward-management/wards/ward-index.module.css`** (1452 lines) — styles for
  `ward-index.tsx`.
- **`src/components/ward-management/wards/ward-index.tsx`** (1031 lines) — the statewide ward
  directory: filter ribbons, capacity KPI strip, one card per ward with a profile modal. Single
  exported component `WardIndex` (291); no sub-components split out.
- **`src/components/ward-management/wards/ward-overview.module.css`** (203 lines) — ⚠️ **ORPHAN.**
  No `ward-overview.tsx` (or any file of that name) exists anywhere in `src/`, and a repo-wide grep
  for `ward-overview.module.css` finds only this file's own path. Nothing imports it.

## Pitfalls in this area

1. **Three components are confirmed unreachable, one of them untested and unrecorded anywhere else
   in this codebase.** `escalation/escalation-board.tsx` and `tracker/live-tracker.tsx` are both
   declared in `tests/ward-component-reachability.test.ts` and on the generated
   `docs/ward-flow/SCREEN-MAP.md`; `governance/governance-screen.tsx` is on `SCREEN-MAP.md` but
   **not** in the test's `DECLARED_UNREACHABLE` list, because that guard only declares orphans some
   test still renders, and nothing renders or imports `governance-screen.tsx` at all. Before editing
   any of the three, check `SCREEN-MAP.md`'s "UNREACHABLE" section first — editing them changes
   nothing a coordinator can see.
2. **The `/governance` route does not render the file in `governance/`.** It renders `GovernanceView`
   /`GovernanceWorkbench` from `ward-management-modes.tsx` / `governance-registers` instead. A
   search for "governance" that stops at the folder name will edit the wrong file.
3. **`board/ward-bed-board.tsx` is a two-line re-export shim that nothing imports.** The live route
   (`board/[unitId]/page.tsx`) imports `WardBoard` from `ward-board.tsx` directly. Confirmed on the
   generated unreachable list, not just inferred from the small file size.
4. **`wards/ward-overview.module.css` has no companion component and no importer anywhere in
   `src/`.** It is the only fully orphaned CSS module found in this pass — worth checking before
   assuming every `.module.css` here is load-bearing.
5. **`movements/traffic-diagram.tsx` is unreachable from any route but IS tested directly**
   (`ward-movements-traffic-diagram.dom.test.tsx`) and is declared as such in
   `ward-component-reachability.test.ts`. Do not assume "has a passing test" means "a coordinator can
   open it" anywhere in this map — verify against the reachability declarations.
6. **`tracker/tracker-derivations.ts` and `on-call-roster.ts`-style logic files are deliberately
   excluded from the reachability guard**, which only scans `.tsx` files
   (`tests/ward-component-reachability.test.ts`, "COMPONENTS ONLY — `.tsx`"). A `.ts` logic module
   imported only by tests is normal unit-test coverage, not a hidden orphan screen — do not flag it
   the same way.
7. **`on-call/on-call-roster.ts` deliberately holds no contact information — this is enforced by a
   pinned key set, not just a convention.** `OnCallRole` has exactly three fields (`id`, `role`,
   `shift`); `tests/ward-on-call-holds-no-people.test.ts` pins them. Adding `name`, `phone`,
   `extension`, `pager` or `email` is a designed-in red, not an oversight to "fix".
8. **`tools/ward-mha-calculator.tsx` must never compute or show a real Mental Health Act statutory
   deadline** — the repo-wide rule in `AGENTS.md` ("Mental Health Act wording") applies here
   directly, and this is the one file in this whole map where breaking it is easiest to do by
   accident.
9. **`patients/patient-now-screen.tsx` (1690 lines) and `settings/settings-screen.tsx` (1898 lines)
   are each a single exported component with no internal sub-components** — unlike
   `handover-page.tsx`, which breaks nine sections out as their own exports. A search for "the
   sub-component that renders X" inside either file will not find one; the logic is inline.
10. **`delays-derivations.ts` documents a real defect Vitest could not catch**: an earlier version
    imported `Instant` from `ward-model` instead of `ward-clock`, a type error that seven tests
    stayed green through because Vitest here does not typecheck. `node
node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit` is the check that would have
    caught it — do not rely on the offline suite alone for a type-shape change in this folder.

## Not checked

The brief named a `delays/backup/` subfolder to cover; it does not exist on this tree (confirmed by
directory listing and a repo-wide `find` for any `backup` path under
`src/components/ward-management/`) — either already removed before this tip or never present on
this branch. Beyond that: I did not open every file's full body — large derivation and screen files
were read via header comments, exported-symbol greps and (for files over 1,500 lines) outline
greps rather than end to end, so an internal helper not matching an export or top-level
`function`/`const` pattern could be missing from an outline. I did not verify every test file's
assertions, only which folder each imports from. I did not check whether any file here duplicates
logic also present in [Screens A](screens-a.md) or [Data and rules](data-and-rules.md) beyond the
specific selector names called out above. I did not run any script, test, or typecheck — all facts
above come from reading source and generated docs, per this job's hard limits.
