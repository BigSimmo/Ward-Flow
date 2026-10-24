# Ward Flow — the task ledger

**Current navigation:** the [task/receipt contract](task-receipts.md) identifies the canonical task
source and Ward project view. This file keeps local task detail and dated evidence; it is not an
exhaustive live backlog. Reuse the existing task identity and verify current scope before acting.
New decisions belong in the [decision log](ward-flow/decisions.md); the
[legacy register](ward-flow-ledger.md) preserves older decision and identity evidence.

_Updated 2026-10-21 - clarify task and decision navigation; Documentation owns. Dated task evidence below is unchanged._

<details>
<summary>Historical introductory claims and navigation — August to October 2026</summary>

<!-- docs-script-refs:historical-start -->

> **Current task navigation — 16 October 2026.** The [task/receipt workflow](task-receipts.md) identifies the canonical task source and Ward project view. This file is a local task-detail/history index, not a competing canonical ledger. Read dated entries as observations of their stated revisions; earlier claims of newest/current/authoritative do not supersede the canonical source or newer evidence. The October 2026 entries (§7.70 through §7.81) record PRs landed on `origin/main` up through commit `5ddeb7d5` (PR #363), plus the 16 October adversarial audit remediation.

**Every outstanding Ward Flow task, in one place. Merged 2026-08-30 from four documents.**

> 🟢 **STATUS AS OF 16 OCTOBER 2026: read this first.** This file now holds the open backlog and the
> recent reconciliation history, **§7.78 to §7.81** below. The 30 August to 13 October record (§6, §7.8 to §7.77 and the
> 13 September master ledger) moved to
> the task ledger history (archived; see [ARCHIVE.md](ARCHIVE.md)) on
> 16 October 2026. Keep it for the reasoning, but do not treat its status lists as current.
>
> - Estate baseline reconciled on 16 October 2026 across PRs #1–#364 (`5ddeb7d5`, PR #363, which merged after #364).

## ⚠️ WHAT THIS IS NOT — read this before editing anything

**This file is ONLY for the Ward Flow prototype.**

The [task/receipt workflow](task-receipts.md) identifies the canonical Ward Flow task source and
project-filtered view. This file supplies local task detail and dated history. The decision register
is [ward-flow-ledger.md](ward-flow-ledger.md); cite decisions rather than copying them.

`docs/outstanding-issues.md` is an inherited, retired PsychSift ledger. Its former 529-row count and
reconciliation process do not describe the dedicated Ward Flow repository or its current task system.
Do not add Ward Flow tasks there.

**Merged from:** `ward-flow-remaining-work.md` (the running record and the reasoning — still the place
to read WHY), `ward-flow-hubs-and-patient-plan.md`, `ward-flow-roadmap.md`, the 17-task plan
(`docs/superpowers/plans/2026-08-29-ward-flow-truthfulness-and-demo-fixes.md`), and
`ward-flow-phase-9-decisions.md`. **Those keep their detail; this holds the list.**

---

<!-- docs-script-refs:historical-end -->

</details>

## Earlier history

Everything from 30 August to 13 October 2026 (the sync points, completion plans, §6 rulings and §7.8 to §7.77) is in
the task ledger history (archived; see [ARCHIVE.md](ARCHIVE.md)). It is kept for the reasoning and is not current.

## §7.78 — Post-Audit Remediation Baseline & Open Issues Ledger (14 October 2026)

Reconciliation snapshot: written at `72375705` (PR #285). Since then PR #284 (`36e68bf`) and PR #283 (`a974d04`) have merged to `origin/main`; items below are marked accordingly.
Branch: `feat/task-ledger-estate-reconciliation`.
Target: Local task-detail and history ledger synchronisation following completion of October audit remediations.

### 1. Landed Estate Baseline (PRs #261 – #285)

- **PR #262 (`feat/audit-remediation-batches`)**: 4-batch repository remediation: Windows `cmd.exe /c az` CLI compatibility, Prototype Pill Cumulative Layout Shift (CLS) fix, Census bed navigation (`?bed=XX` URL sync), D-30 transfer coordinator role gate, CI cache tests.
- **PR #263 (`feat/task-ledger-safety-fixes`)**: Critical safety fixes: AUD-02 Windows drive-letter casing guard in `guard-push.mjs` and `check-ward-data.mjs`; AUD-04 `WardDailySheet` deterministic clock fallback preventing epoch-0 (1970) duration calculations; AUD-05 in-transit bed expiry false alarm suppression; involuntary badge presentation when legal form is unrecorded.
- **PR #272 (`claude/clinical-audit-round-2-m6ji0x`)**: Round 2 clinical audit fixes: phone safety disclosures ("Published, not call-tested"), unified referral flow, truthful patient presence counts ("On this board now"), 44px phone tap targets.
- **PR #273 (`codex/pr261-rebuild-20261013`)**: Portable database architecture introducing Supabase + local PostgreSQL support with multi-database selector (`azure` | `supabase` | `postgres`), preserving Azure schema contracts.
- **PR #274 (`codex/pr265-rebuild-20261013`)**: Validated batches, derivations, and comprehensive runtime reducer guard scan.
- **PR #276 (`claude/phone-tap-sizes-stp74x`)**: Mobile tap ergonomics: text fields and Delays filter chips upgraded to full 44px minimum tap boundaries.
- **PR #277 (`ui/275-ui-polish`)**: Modular UI-only ergonomics and layout polish.
- **PR #278 (`codex/backend-foreign-schema-grant-preflight`)**: Startup grant preflight: refuses to start when the runtime database role holds unexpected read grants outside the `ward_flow` schema. It checks the role's grants once at startup (it does not inspect individual queries) and permits `pg_catalog`, `information_schema` and four allowlisted extension/cron relations.
- **PR #279 (`feat/group-a-clinical-fixes`)**: Group A clinical, legal, and operational defect remediation:
  - **S1-4 & S2-4**: Dispatches cancellation notices to transport officers (`{ role: "officer" }`) upon referral withdrawal; sends pre-acceptance revocation notices to receiving wards.
  - **A3-10 & S2-7**: Stopped-transport held beds surfaced in Handover under actionable placements to eliminate indefinitely stranded psychiatric beds.
  - **A3-2**: Handover expiry derivation suppresses false "Expired pulled bed" warnings once patient is collected into transit.
  - **A1-4**: Restores statutory continuation legal forms (Form 5B, 3C, 6B, 6C) to the legal audit trail alongside selectable forms.
  - **A1-6**: Restores patient identity in movement audit records for unscheduled walk-in admissions lacking an ED referral.
  - **A4-11**: Logger context sanitisation preventing context payloads from overwriting canonical `level`, `message`, and `timestamp`.
- **PR #280 (`claude/project-thread-nintor`)**: Remaining pages audit fixes: correct presence counts, privacy mask on Statistics, printable emergency downtime packet (resolved), Menu over sheets.
- **PR #281 (`claude/audit-verified-fixes-20261013`)**: Verified audit fixes: shortlist gender-placement state reset on patient switch; bed-hold expiry transport property check; daily sheet clock pass-through.
- **PR #285 (`feat/p1-p2-authority-and-capacity-fixes`)**: Speed, bundle diet, decoupling of 30-second autosave timer from search/navigation churn, and sub-100ms search latency optimizations:
  - **Workstream A**: State & 30s clock tick decoupling (`useWardClock`), memoized `<WardBedCard>` re-renders, fast structural dirty check (`isSameWorld`), frozen array constants.
  - **Workstream B**: Bundle payload diet: dynamic import for `@azure/msal-browser` (~290 KB saved), extracted `handover-scope.ts` eliminating 63.3 KB leaked CSS, code-splitting secondary dialogs/drawers via `next/dynamic`.
  - **Workstream C**: Sub-100ms search latency (`shouldDeriveSearchTasks`), 60fps input debouncing (`useDebouncedValue`), React 19 `startTransition` on screen tab navigation.
  - **Workstream D**: Notification banner layout anchoring eliminating CLS, SVG map code-splitting, tabular font metrics.
  - **Option A & B Authority Remediations**: Cross-ward action authority (`actingUnitId` validation on `ACCEPT_IN_PRINCIPLE`, `PULL_PATIENT`, `DECLINE`), statutory legal form paper expiry role restriction to `["ed", "coordinator"]` (A1-5), phantom free bed prevention via `arrivalCapacityConflicts` (S2-3), revoked exam referral unwinding (S1-5).

### 2. Landed After the Snapshot (PR #284, PR #283)

- **PR #284 (`feat/engine-and-screen-fixes`)**:
  - **Status**: **Merged** to `origin/main` as `36e68bf`. It was green across all 18 CI shards before merge. Per-fix detail is in §7.79.
  - **Scope (19 Engine & Screen Remediations; the 13 below are the headline items, and all 19 are listed individually in §7.79)**:
    - **A3-4**: Corrects delay cause evaluation order in `delays-derivations.ts` so unreferred patients with no eligible bed network-wide (`WF-308`) retain the `no_eligible_bed` severe delay category, while referrable unreferred patients classify under `awaiting_coordinator`.
    - **A3-12**: Incorporates `examinationRevokedWhileBedHeld(movement)` in `causeOf` to correctly route community order and revoked exam holds to the coordinator rather than stranding under `awaiting_transport`.
    - **A3-7**: Records per-destination `referredAt` on queued referral addressings (`RECEIVE_REFERRAL`); derives silence reminders from the oldest live awaiting arm, with synchronised type declarations in `statistics-claims-register.ts`.
    - **A1-13**: Restricts broadcast alert acknowledgments for `COORDINATOR_DESK_ACKNOWLEDGER_ID` strictly to `role: "coordinator"`.
    - **S2-6**: Rejects `RECORD_REPATRIATION` for discharged admissions (`admission.state === "departed"`) or closed movements.
    - **S1-12**: Enforces `actingUnitId === admission.unitId` when updating expected discharge date as `role: "ward"`.
    - **S2-14**: Validates referral withdrawal stage guards against `isMovementWithdrawable`.
    - **S1-3**: Preserves `patientId` on unscheduled walk-in community intake.
    - **S1-6**: Placement overrides only appended when units actually received an override.
    - **S2-5**: Rejects `SET_ARRIVAL_DETAILS` on closed movements.
    - **S1-14**: ED medical bed release window kept at 24 hours per the clinical owner ruling of 14 October 2026 (the constant in `ward-model.ts` is 24; an earlier draft of this line said 48 in error).
    - **A1-11**: Distinguishes expiry-recorded from extension-recorded based on `priorDueAt`.
    - **Backend 409 Conflict**: Differentiates conditional write revision conflicts from operational Azure storage 409 errors.

### 3. Open Estate Tasks & Unresolved Work (14 October 2026)

The following items are the prioritised open backlog as of this snapshot. This list is not exhaustive: other unresolved work stays active in the earlier register entries (Group 7 of the register, in the 13 October entries around §7.75-§7.77) and in §7.79, including SPEC-005 (queue ordering), M-DEAD (retired `ward-chrome-header` module), M-TOKENS (the remaining `.btnPrimary` definitions), the remaining remediation tasks and hosted-state verification. Nothing in those entries is closed by this section.

1. **PR #283 (`feat/group-b-ui-perf-accessibility`)**:
   - **Status**: **Merged** to `origin/main` as `a974d04` (accessibility, focus traps, bundle code-splitting, search responsiveness). Nothing further to do except the physical-device check in item 3.
2. **PR #284 (`feat/engine-and-screen-fixes`)**:
   - **Status**: **Merged** to `origin/main` as `36e68bf`.
3. **Safari / Real iOS Physical Device Walkthrough (Audit Safari / D1)**:
   - **Status**: Open.
   - **Requirement**: Physical iPhone Safari device inspection. Synthetic Chromium emulation cannot replicate dynamic URL bar collapsing, bottom safe-area insets (`env(safe-area-inset-bottom)`), or virtual keyboard interaction with the fixed bottom dock.
4. **AUD-03 (Bed-Hold Countdown Arithmetic Unit Tests)**:
   - **Status**: **Closed, already covered** (checked 21 Oct 2026). `tests/ward-bed-hold.test.ts` tests the lapsed, at-risk and held boundaries and `tests/ward-bed-hold-expiry-in-transit.test.ts` the review threshold (2 hours). There is no 15-minute rule.
   - **Requirement**: Unit test suite for `bedHoldExpiryAlert` hold countdown arithmetic, verifying boundary behavior at 0m, 15m, 60m, and expired transitions.
5. **AUD-06 (Multi-Ward Rapid Click Reducer Serialization)**:
   - **Status**: **Resolved** 21 Oct 2026. Every event names its own ward and React serialises dispatch, so the record was safe; the ward answer view now resets per ward like the overview (`tests/ward-switch-stale-action.dom.test.tsx`).
   - **Requirement**: Prevent stale reducer action overwrites when clinicians switch rapidly between wards in the UI under concurrent event dispatch.
6. **Gender Placement Validation Gate**:
   - **Status**: **Resolved** (enforced in `ward-eligibility.ts` and `ward-flow-reducer.ts`, with shortlist gender-placement state reset verified in PR #281).
   - **Requirement**: Validate incoming bed assignments against ward sex mix rules, ensuring non-binary / other gender placements cannot bypass procedural verification.
7. **Discharge Block Reason Mandatory Selector**:
   - **Status**: **Resolved** (mandatory clinician reason selection enforced prior to unblocking discharge delays).
   - **Requirement**: Require clinician reason selection from fixed taxonomy prior to unblocking discharge delays.
8. **CAP-REV (Capacity Request Revision Decoupling)**:
   - **Status**: **Resolved** 21 Oct 2026 (branch `claude/project-thread-yu7210`). Each request records the ward's confirmation count (`allocatable.confirmations`, moved on only by `CONFIRM_CAPACITY`), and it reads as answered once the shared unit's count has moved past it, so it clears on every desk and the shared site, no other bed change answers it, and a confirmation from an older board does not clash with the ask. #290 had been credited with this but never built it.
   - **Requirement**: Record a confirmation counter on each Capacity request so request ordering and clearance do not rely on minute-level timestamps. Implemented as `allocatable.confirmations`, because the general allocatable revision also moves on other bed changes.
9. **Code-Map Route Audit Synchronization**:
   - **Status**: Open.
   - **Requirement**: Refresh `docs/ward-flow/code-map/shell-and-shared.md` to index 8 unmapped route entry points (including `/command`, Statistics sub-routes, and report entry points).
10. **Multi-User Shared Database Verification**:
    - **Status**: Open (local backend persistence and optimistic concurrency verified; live cloud staging parked outside prototype gate).
    - **Requirement**: End-to-end multi-user test of authenticated shared save/reload and conflict reconciliation against live PostgreSQL / Supabase staging instance.

#### Category 1: Quick & Low-Risk Polish (Text, Markup, Config, Docs)

- **TASK-L1-01 (A4-5)**: Correct stale `DeveloperAreaGate` comments in `src/proxy.ts` and `src/app/mockups/layout.tsx` (gate removed 28 Sept).
- **TASK-L1-02 (Live Leftovers)**: Align `settings-panes.tsx` "Live" option and Sovereign "Live" tab with "Demo" terminology.
- **TASK-L1-03 (ClinicalRail comments)**: Correct comments describing `ClinicalRail` as mounted.
- **TASK-L1-04 (R7)**: Add `background_color` property to `src/app/manifest.ts`.
- **TASK-L1-05 (R9)**: Add sign-in route to the landmark test suite.
- **TASK-L1-06 (R14)**: Prevent `prefetch={false}` leaking onto test anchor DOM attributes.
- **TASK-L1-07 (Touch Target)**: Enlarge 36px "New referral" sibling button to the repository standard 48px touch target.
- **TASK-L1-08 (M-WARD-ANSWER)**: Add explanatory helper text or hide the disabled "Accept in principle (waitlist)" button in ward answer view.
- **TASK-L1-09 (D7)**: Add helper sentence explaining why "Refer to selected wards" is disabled when no units are chosen.
- **TASK-L1-10 (M-STATUS / M-HOSTING)**: Reconcile stale commits, deployment claims, and test counts in `docs/ward-flow/STATUS.md` and `docs/hosting.md`.
- **TASK-L1-11 (M-CODEMAP)**: Refresh `code-map/shell-and-shared.md` to index all 50 mockup page entry points (currently documents 42).
- **TASK-L1-12 (M-TOKENS)**: Consolidate duplicate local `.btnPrimary` definitions across five CSS modules into shared design tokens.
- **TASK-L1-13 (M-DEAD)**: Remove retired `ward-chrome-header.tsx`, `governance-screen.tsx`, and unused Postgres fixtures (requires owner approval gate; note that `eventCarriesFreeText()` (`D-18`) is implemented and active in `src/lib/ward-flow/ward-state-context.tsx:91`).

#### Category 2: Remaining Contained Engine & Derivation Fixes (Moderate Risk)

- **TASK-L2-01 (S2-15)**: Attribute alert stand-down audit events to the specific role that performed the action.
- **TASK-L2-02 (A3-3 / A3-5)**: Fix "Nowhere eligible" filter listing patients with allocated beds, and ensure accepted patients remain discoverable in search.
- **TASK-L2-03 (A3-8 / A3-9)**: Prevent withdrawn referrals from disappearing prematurely from the board; eliminate false "declined by all" banners.
- **TASK-L2-04 (A3-1 / A3-13 / A3-14)**: Capacity screen: resolve double-counting of pulled patients and stuck "not settled" state banners.
- **TASK-L2-05 (A2-4)**: Guard against null timestamps from local storage raising false legal-due alarms.
- **TASK-L2-06 (A2-6 / A2-7)**: Improve session storage failure reporting; prevent 30-second autosave from undoing explicit "Clear session".
- **TASK-L2-07 (A2-10 / A2-15)**: Reset "Since last look" state cleanly on session clear; ensure reload crossing midnight handles date rollover.
- **TASK-L2-08 (A4-1 / A4-2 / A4-10)**: Strengthen synthetic-data guard pattern matching for edge-case ID formats; sanitize "Copy diagnostics" exports.
- **TASK-L2-09 (A4-12 / A4-15)**: Add CSRF header validation on mutable endpoints and harden fail-open webhook stubs.
- **TASK-L2-10 (A4-6 / A4-7)**: Restrict CSP bypass on routes with image extensions; pin or remove unpinned CDN script tags in static HTML mockups.

#### Category 3: Remaining Core Reducer Invariants (Higher Complexity)

- **TASK-L3-01 (S2-7)**: Ensure release-and-reopen workflow only reports bed releases when a physical bed was actually held.
- **TASK-L3-02 (S2-13)**: Prevent transfer-out events from advancing the discharge revision sequence twice.
- **TASK-L3-03 (S1-8)**: Ensure re-pulling a patient resets the hold expiry countdown instead of retaining the old timestamp.
- **TASK-L3-04 (A1-7)**: Ensure ward-initiated referrals are not misattributed to community teams in audit logs.
- **TASK-L3-05 (A1-9)**: Remove `ward` and `community` roles from `RECORD_MOVEMENT_MEDICAL_CLEARANCE` permissions.
- **TASK-L3-06 (Shared Close Helper: S1-7)**: Unify movement closure logic across remaining closure triggers to guarantee consistent referral unwinding, notice generation, and waitlist cleanup.
- **TASK-L3-07 (Tighter Load Validator: A2-3, A2-5)**: Validate snapshot data on import to reject malformed event payloads (rendering type bugs S1-9, S1-10, S1-11 unreachable).

#### Category 4: Standing Architecture & External Integration Roadmap

- **TASK-L4-01 (Safari / Physical Device Walkthrough - Safari / D1)**: Physical iPhone Safari inspection of collapsing URL bars, bottom safe-area insets (`env(safe-area-inset-bottom)`), and virtual keyboard interaction with bottom dock.
- **TASK-L4-02 (AUD-03 Bed-Hold Countdown Arithmetic Unit Tests)**: Unit tests for hold expiry arithmetic (`bedHoldExpiryAlert`).
- **TASK-L4-03 (AUD-06 Multi-Ward Rapid Click Reducer Serialization)**: Reducer action serialization under rapid ward switching.
- **TASK-L4-04 (S2-9 Gender Match Validation)**: Gender match & security classification validation on bed placements against ward mix policies (gender placement validation resolved; S2-9 security comparator alignment tracked in §7.79).
- **TASK-L4-05 (Discharge Block Reason Selector)**: Mandatory clinician reason selection prior to discharge delay unblocking (Resolved).
- **TASK-L4-06 (CAP-REV Capacity Request Revision Decoupling)**: Record the ward's confirmation count (`allocatable.confirmations`) on requests to avoid timestamp collisions (Resolved 21 Oct 2026, see item 8 above).
- **TASK-L4-07 (Code-Map Route Audit Synchronization)**: Refresh `docs/ward-flow/code-map/shell-and-shared.md` to index 8 unmapped route entry points.
- **TASK-L4-08 (Live Database Staging)**: Multi-user shared save/reload and conflict reconciliation verification on live PostgreSQL / Supabase instance.
- **TASK-L4-09 (PERF-01 Retire 5 Orphaned Statistics CSS Files - 134.2 KB)**: Delete unimported legacy files in `src/components/ward-management/statistics/` (awaiting explicit approval).
- **TASK-L4-10 (PERF-02 Design Token Consolidation)**: Deprecate `ward-flow-v6-tokens.css` in favor of consolidated `ward-flow-v9-tokens.css` (~90 KB uncompressed CSS reduction).
- **TASK-L4-11 (PERF-03 Edge CDN Caching vs Origin Nonces)**: Security header strategy to enable Edge CDN caching (Closed 21 October 2026: Josh ruled to keep the per-request CSP nonce and not edge-cache HTML; see the `src/proxy.ts` header comment).
- **TASK-L4-12 (PERF-04 Deep-Link Scroll Timing on Lazy Secondary Views)**: Explicit post-mount scroll event for hash links navigating to dynamically imported tabs.
- **TASK-L4-13 (A2-14 Unused Standalone Clock Provider)**: Retire or align unused standalone `WardFlowClockProvider` in `ward-flow-provider.tsx`.

#### Category 5: Owner Policy Decisions (Ruled 14 October 2026)

- **DEC-L5-01 (S2-2)**: Revoked-examination hold release — **Ruled**: Refuse generic blocker edits on revoked-exam / stopped-transport holds; require explicit `RELEASE_HELD_BED`.
- **DEC-L5-02 (A1-8, A1-10, S2-10, A1-13, A1-14)**: Ward unit authority — **Ruled**: Require matching `actingUnitId` for `ward` callers on arrival details, no-transport-needed, transport booking, and origin verification on referral corrections (coordinators unrestricted).
- **DEC-L5-03 (A1-2)**: Referral withdrawal authority — **Ruled**: Only the originating referrer (matching ED/community `actingPlaceId` or originating inpatient ward `actingUnitId`) plus the `coordinator` may withdraw a referral.
- **DEC-L5-04 (CAP-REV)**: Capacity request ordering — **Ruled**: Record an explicit `allocatableRevision` counter on capacity update requests so only an actual capacity confirmation clears the request. Implemented 21 Oct 2026 as `allocatable.confirmations`, a counter only `CONFIRM_CAPACITY` moves, since the general revision also moves on other bed changes.
- **DEC-L5-05 (SPEC-005)**: Home queue ordering policy — **Ruled**: Keep D-32 ordering (actionable stage first, then longest wait) and render ATS + Flagged Urgent as distinct visual badges without overriding wait-time order.

#### Category 6: Front-End, UX, Accessibility & Architecture Audit Backlog (October 2026)

- **TASK-L6-01 (AUD-UX-01 / In-App Client Navigation Draft Loss Protection)**: Connect `use-dirty-state-guard.ts` to client-side Next.js App Router navigation transitions (`<Link>`, `router.push`, header/phone menu links) in `add-patient.tsx` and `shortlist-panel.tsx`. Currently, form dirty state is only guarded against tab/window closure via `window.beforeunload`; internal router navigation silently discards unsubmitted patient creation and referral drafting.
- **TASK-L6-02 (AUD-A11Y-01 / Active Mockup Custom ESLint Accessibility Coverage)**: Refine `MOCKUP_IGNORES` in `eslint.config.mjs:35` so custom repository accessibility rules (`local/require-button-wiring`, `local/require-lucide-icon-aria`) actively lint production mockup components under `src/app/ward-flow/**` while preserving test and experimental file exemptions.
- **TASK-L6-03 (AUD-ARCH-01 / Progressive Domain Slice Reducer Migration)**: Partition `ward-flow-reducer.ts` (10,458 lines, 557 KB) into domain slice reducers (`movementReducer`, `referralReducer`, `admissionReducer`, `careSettingsReducer`, `broadcastAlertReducer`) using typed action routing. This eliminates the central architectural monolith, drastically reducing TypeScript compiler overhead and isolating domain test failures.
- **TASK-L6-04 (AUD-ARCH-02 / Screen Monolith Decomposition >3,000 LOC)**: Progressively decompose 6 oversized screen monoliths exceeding 3,000 LOC (`ed-screen.tsx` at 6,791 lines, `community-screen.tsx` at 5,986 lines, `ward-referral-drawer.tsx` at 4,039 lines, `ward-board.tsx` at 3,796 lines, `ward-movements.ts` at 3,250 lines, and `ward-screen.tsx` at 3,182 lines) by extracting modular sub-panels, modal controllers, and domain hooks.
- **TASK-L6-05 (AUD-NAV-01 / Same-View Deep-Link Hash Navigation)**: Complete `useStatisticsView` reactive `hash` tracking so internal anchor navigation between cards within the same view (e.g. `#journey-overview` to `#journey-stages`) automatically triggers smooth scrolling and `MutationObserver` card resolution without requiring a full `view` state switch.
- **TASK-L6-06 (AUD-TEST-01 / Dynamic Import Loading State Harness)**: Extend `tests/setup/jsdom.setup.ts` with a controlled deferred-resolution test helper to verify intermediate loading states, accessible skeleton landmarks, and headings for dynamic components (`WardAnswerView`, lazy tab panes) prior to chunk load.
- **TASK-L6-07 (AUD-A11Y-02 / Explanatory Button Automated Regression Floor)**: Add automated static regression check (`scripts/ward-flow/check-explanatory-buttons.mjs` or custom ESLint rule) ensuring no interactive control combines native `disabled` with `aria-describedby`, enforcing the `aria-disabled="true"` + `ignoreUnavailableActivation` standard repository-wide.
- **TASK-L6-08 (AUD-SITEMAP / App Router Route Map Reachability)**: Audit all 50 Next.js App Router page routes under `src/app/ward-flow/` (52 total `/mockups` routes) to ensure every route is reachable via top navigation, phone menu, breadcrumbs, or deep links, eliminating orphan routes.
- **TASK-L6-09 (AUD-PERF-05 / Dynamic Import Loading Skeletons)**: Add dimension-matched skeleton loaders to dynamic code-split views (`WardAnswerView`, lazy statistics tabs) to eliminate Cumulative Layout Shift (CLS) on slow network chunk arrivals.

## §7.79 — Engine Fixes (PR #284) & Audit Task Inventory (14–15 October 2026)

Branch: [PR #284](https://github.com/BigSimmo/Ward-Flow/pull/284) (`feat/engine-and-screen-fixes`), merged to `origin/main` as `36e68bf`.

### 1. Remediations in PR #284 (19 Defect Remediations)

- **S2-6 (Discharged Repatriation Guard)**: `src/components/ward-management/ward-flow-reducer.ts:10418` — Rejects `RECORD_REPATRIATION` for discharged admissions (`state === "departed"` or `leftAt !== null`) while permitting standard occupied admissions with prior movement closure outcome `"arrived"`.
- **S1-3 (Walk-In Community Referral Patient Link)**: `src/components/ward-management/ward-flow-reducer.ts:3702` — Preserves `patientId` for unscheduled walk-in community intake (`linkedReferral?.patientId ?? movement.patientId`).
- **S1-6 (Unneeded Clinical Placement Overrides)**: `src/components/ward-management/ward-flow-reducer.ts:4238` — Rejects `REFER_TO_UNITS` carrying an `overrideReason` when no new units are permitted, preventing unattached override records or silent override drops.
- **S2-5 (Arrival Updates on Closed Movements)**: `src/components/ward-management/ward-flow-reducer.ts:9642` — Rejects `SET_ARRIVAL_DETAILS` if `movement.closure` is set.
- **S2-13 (Deduplicated Transfer-Out Revision Increment)**: `src/components/ward-management/ward-flow-reducer.ts:5900` — Removed duplicate manual increment in `PATIENT_ARRIVED` transfer-out handler; `departAdmission` now advances the counter exactly once.
- **S2-14 (Referral Withdrawal Visibility Guard)**: `src/components/ward-management/ward-referrals.ts:140` — `referralWithdrawable` checks linked movements and hides the withdraw button on non-withdrawable stages (`moving`, `arrived`, `closed`).
- **S2-15 (Broadcast Alert Stand-Down Role Attribution)**: `src/components/ward-management/alerts/ward-broadcast-reducer.ts:195` and `src/components/ward-management/ward-audit.ts:338` — Records `stoodDownBy: event.stoodDownByRole ?? event.role` on the `BroadcastAlert` record and honours `stoodDownByRole` in `auditActor`.
- **S1-12 (Scoped Unit ID on Expected Discharge Edits)**: `src/components/ward-management/ward-flow-reducer.ts:2689` — Strictly requires `actingUnitId` to match `admission.unitId` when role is `ward`.
- **S1-14 (ED Medical Bed Release Window Constant)**: `src/components/ward-management/ward-model.ts:538` — Retains `ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS = 24` per clinical owner ruling of 14 October 2026 (`d1248af4`), aligning the constant and tests with the 24-hour clinical contract.
- **A1-7 (Cross-Role Referral Attribution)**: `src/components/ward-management/ward-role-permissions.ts:42` — Preserved `CROSS_ROLE_ALLOWED` contract for inpatient ward referrals without opening unvalidated sender roles.
- **A1-11 (Initial Legal Form Expiry vs Extension)**: `src/components/ward-management/ward-audit.ts:701` — Accurately labels initial expiry as `"expiry-recorded"` and subsequent edits as `"extension-recorded"`.
- **A1-13 (Coordinator Alert Acknowledgment Role Authorization)**: `src/components/ward-management/alerts/ward-broadcast-reducer.ts:144` — Restricts `COORDINATOR_DESK_ACKNOWLEDGER_ID` acknowledgments to `role === "coordinator"`.
- **A3-4 (Delays Board Categorization for Unreferred Patients)**: `src/components/ward-management/delays/delays-derivations.ts:254` — Classifies unreferred patients with zero eligible beds across WA as `"no_eligible_bed"` while routing patients with eligible beds to `"awaiting_coordinator"`.
- **A3-6 (Separate Waitlist Answers from Declines in Metrics)**: `src/components/ward-management/ward-derivations.ts:1575` — Filters out `WAITLIST_INSTEAD_OF_DECLINE_REASONS` from `allDeclines()`.
- **A3-7 (Measure Ward Silence Per Destination)**: `src/components/ward-management/delays/delays-derivations.ts:636` — Stamped `referredAt: event.now` on `ReferralAddressing` destinations and anchored ward silence timer to oldest awaiting destination.
- **A3-11 (Delay Inactivity Timers State Transitions)**: `src/components/ward-management/delays/delays-derivations.ts:403` — Includes `acceptedAt` and `pullRequestedAt` in `lastRecordedActivity`.
- **A3-12 (Route Revoked-Exam Holds to Coordinator)**: `src/components/ward-management/delays/delays-derivations.ts:265` — Routes revoked examinations (`examinationRevokedWhileBedHeld`) to `"awaiting_coordinator"` rather than transport dispatch.
- **A2-8 (Optimistic Concurrency 409 vs 503)**: retired with Azure (D-55, 15 October 2026). It described `backend/ward-flow/database.mjs:71` mapping Azure Storage precondition/revision failures to HTTP 409 Conflict; that file and Azure storage are gone; the current backend is described in [DATABASE.md](ward-flow/DATABASE.md).
- **A4-8 (Tenant Token Claims Verification for Guest Accounts)**: retired with Microsoft Entra ID (D-55, 15 October 2026). It described Entra `payload.tid === config.tenant` and `WardFlow.Access` scope checks in `backend/ward-flow/auth.mjs:43`; sign-in is now Supabase (see [DATABASE.md](ward-flow/DATABASE.md)).

---

### 2. Remaining Open Tasks Inventory (Categorized by Domain)

The following outstanding tasks from recent engine audits, accessibility reviews, and backlog inventories are registered for subsequent implementation streams:

#### Stream 1: Core State Machine & Reducer Invariants

| ID              | Title / Location                                                        | Issue Summary                                                                                                                | Target Resolution                                                                              | Status                                     |
| :-------------- | :---------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- | :----------------------------------------- |
| **S1-7**        | Purge Lingering Waitlist Entries (`ward-flow-reducer.ts:3601`)          | When a patient is accepted by Ward A, their waitlist entry on Ward B survives and can falsely block real waitlist capacity.  | Clear all pending waitlist entries across other wards once a definitive bed acceptance occurs. | Resolved (#290)                            |
| **S2-9**        | Align Security Gate Definitions (`ward-eligibility.ts:601`)             | Security gate check (Open vs Closed unit) uses slightly different matching rules between the two clinical eligibility paths. | Unify both evaluation paths to use the same security level comparator.                         | Resolved (#290 + Part 1 contract/test pin) |
| **S1-5**        | Clear Target Units on Revoked Examination (`ward-flow-reducer.ts:7410`) | Revoking an examination order when a patient had pending referrals leaves unit targets in intermediate state.                | Clear target unit IDs when an involuntary examination order is revoked.                        | Resolved (#285 / #290)                     |
| **S1-9..S1-11** | Urgency Enum Runtime Validation (`ward-flow-reducer.ts`)                | Reducer accepts raw urgency strings without strict runtime enum boundary checks.                                             | Enforce runtime enum boundary validation for clinical urgency in reducer handlers.             | Resolved (#290)                            |
| **S2-3**        | Phantom Free Bed on Full Ward Arrival (`ward-flow-reducer.ts`)          | Over-capacity arrival into a full ward can later miscalculate available beds.                                                | Guard bed count derivation against phantom bed release during overcapacity admissions.         | Resolved (#285 / #290)                     |
| **S1-8**        | Bed Re-Pull Hold Expiry Reset (`ward-flow-reducer.ts`)                  | Re-pulling a bed hold retains the previous hold expiry timestamp.                                                            | Refresh `pullExpiresAt` upon re-pull action.                                                   | Resolved (#290)                            |

#### Stream 2: UI Accessibility, Focus Management & Ergonomics

| ID                | Title / Location                                              | Issue Summary                                                                                                                                                           | Target Resolution                                                                                         | Status                                         |
| :---------------- | :------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------- | :--------------------------------------------- |
| **AUD-11**        | Choice Indicator Visibility (`choice.tsx:133, 268`)           | Verified that checkbox and radio sibling containers already apply `peer-checked:[&_svg]:opacity-100` / `peer-checked:[&>span]:opacity-100` to reveal nested indicators. | Already resolved in `src/components/ui/choice.tsx` via sibling container `peer-checked` child selectors.  | Resolved                                       |
| **AUD-12**        | Accessible Heading Landmarks (`ward-management-modes.tsx:79`) | Network and Governance pages lack visible or accessible `<h1>`; currently sits in a `hidden` header.                                                                    | Add visually hidden accessible `<h1>` (`sr-only`) inside `<main id="main-content">`.                      | Resolved (#290 + Part 1 `<main>` containment)  |
| **AUD-ESC**       | Modal Escape Key Event Bubbling (`ward-screen.tsx`)           | Pressing Escape in a top-level modal bubbles down and simultaneously dismisses underlying background bed drawers.                                                       | Stop event propagation on Escape dismiss within modal dialog containers.                                  | Resolved (#290)                                |
| **AUD-13**        | Drawer Focus Trapping Decoupling (`ward-tasks-drawer.tsx`)    | Focus trapping runs even when drawer is in non-modal / backdrop-less preview mode.                                                                                      | Decouple focus trapping so it only engages when modal backdrop is active; keep local Escape dismissal.    | Resolved (#290 + Part 1 local Escape handling) |
| **AUD-URL**       | Bed Dossier URL Params Sync (`ward-screen.tsx`)               | Opening a bed dossier does not update URL query parameters (`?bed=XX`), preventing deep linking and back-button navigation.                                             | Synchronize open bed dossier state with URL search params using `useSearchParams` / `useRouter`.          | Resolved (#290)                                |
| **M-WARD-ANSWER** | "Accept in Principle" Visibility (`ward-answer-view.tsx`)     | "Accept in principle (waitlist)" button renders in disabled/opaque state when no referrals are pending.                                                                 | Conditionally render or provide accessible explanatory tooltip when no actionable referrals exist.        | Resolved (#290 / #291)                         |
| **D7**            | Disabled Referral Submission Guidance (`referral-match.tsx`)  | "Refer to selected wards" button is disabled without explanation of missing placement criteria.                                                                         | Render accessible helper guidance text and `aria-describedby` explaining why referral button is disabled. | Resolved (#290)                                |

#### Stream 3: CSS Stability, Design Tokens & Responsive Layout

| ID           | Title / Location                                          | Issue Summary                                                                                     | Target Resolution                                                                                | Status                           |
| :----------- | :-------------------------------------------------------- | :------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------- | :------------------------------- |
| **D2**       | Replace Broad `transition: all` (CSS modules)             | Wildcard `transition: all` triggers unintended layout reflows and jank during drawer animations.  | Replace `transition: all` with explicit properties (`transform`, `opacity`, `background-color`). | Resolved (#290)                  |
| **D3**       | Bed Matrix CLS Prevention (`ward-beds-matrix.module.css`) | Bed matrix cards lack minimum container height floors, causing layout shifts during data loading. | Enforce explicit `min-height: 480px` floors on bed matrix containers.                            | Resolved (#290)                  |
| **D5**       | PWA Web App Manifest Shortcuts (`src/app/manifest.ts`)    | PWA manifest lacks dedicated launcher shortcuts for key workflows.                                | Add shortcuts for Ward Flow workflows with `short_name` and `description` metadata.              | Resolved (#304 + Part 1 details) |
| **M-TOKENS** | Consolidate Primary Buttons to Tokens (5 CSS modules)     | Ad-hoc local `.btnPrimary` classes bypass shared design token variables.                          | Migrate remaining button styles to `--wf-btn-primary` token contract.                            | Resolved (#290)                  |

#### Stream 4: Derivations, Timers & Communication State

| ID              | Title / Location                                                                  | Issue Summary                                                                                                                     | Target Resolution                                                                                      | Status          |
| :-------------- | :-------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------- | :-------------- |
| **A3-15**       | Harmonize Bed Freeing Date to WA Midnight (`ward-screen.tsx`, `beds-forecast.ts`) | Expected discharge date comparisons use UTC midnight rather than WA local midnight (`AWST`), causing edge-of-day miscalculations. | Use `dayOf()` with Western Australia timezone offset for bed forecast calculations.                    | Resolved (#290) |
| **A3-8/A3-9**   | Referral Withdrawal vs Multi-Ward Decline (`ward-referrals.ts`)                   | Screen derivation collapses "Withdrawn by Referrer" into "Declined by all receiving wards".                                       | Explicitly distinguish referrer withdrawal states from simultaneous ward declines in badge indicators. | Resolved (#290) |
| **A2-11/A2-12** | BroadcastChannel Singleton & Storage Debounce (`use-ward-flow.ts`)                | BroadcastChannel created per event dispatch; local storage sync runs on every keystroke/dispatch without debouncing.              | Wrap `BroadcastChannel` in a module singleton and debounce local storage sync by 300ms.                | Resolved (#290) |
| **A1-15**       | Coordinator Role Attribution in Cockpit (`coordinator-cockpit.tsx`)               | Cockpit events should consistently pass `role: "coordinator"` instead of defaulting to generic route role.                        | Audit and pin `role: "coordinator"` on all cockpit dispatches with tests.                              | Resolved (#290) |

#### Stream 5: Backend Security, Plumbing & Test Harness Hygiene

| ID               | Title / Location                                                     | Issue Summary                                                                                                                         | Target Resolution                                                                                            | Status                                   |
| :--------------- | :------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------- | :--------------------------------------- |
| **A4-12**        | Enforce CSRF Header on State Mutation (`api-csrf.ts:111`)            | Mutation endpoints permit requests without CSRF protection headers.                                                                   | Reject state mutation requests lacking valid CSRF headers (`x-ward-flow-csrf`).                              | Resolved (#290)                          |
| **A4-13**        | Localhost Host Header Validation (`local-project-guard.ts:114`)      | While `scripts/dev-free-port.mjs:157` binds to `127.0.0.1` by default, `local-project-guard.ts:114` does not validate `Host` headers. | Validate incoming `Host` headers against allowed local loopback/preview origins in `local-project-guard.ts`. | Resolved (#290)                          |
| **A4-15**        | Remove Stale PsychSift Security Plumbing (`privacy.ts:1`)            | Unused legacy webhook exception and RAG privacy rules from PsychSift repository remain in code.                                       | Prune legacy PsychSift code and keep only Ward Flow privacy logic.                                           | Resolved (#290)                          |
| **STATIC-CLEAN** | Purge Obsolete Standalone Static HTML Mockups (`public/*.html`)      | Standalone static HTML mockups in `public/` bypass React/Next.js architecture and load unpinned CDN resources.                        | Remove external `cdn.tailwindcss.com` script and enforce `noindex, nofollow` meta + headers.                 | Resolved (#290 + Part 1 zero-CDN inline) |
| **R09**          | Sign-In Landmark Accessibility Test (`tests/ward-landmarks.test.ts`) | `/ward-flow-sign-in` missing from automated landmark audit assertions.                                                                | Add test coverage verifying `<header>`, `<main id="main-content">`, and landmark structure.                  | Resolved (#290)                          |
| **R14**          | Suppress Next.js `prefetch` Test Warnings (`tests/test-utils.tsx`)   | Tests rendering plain `<a>` tags with `prefetch={false}` generate console warnings in test runner.                                    | Filter or strip `prefetch` attribute in custom test render wrapper.                                          | Resolved (#290)                          |
| **AUD-14**       | Portable Developer Paths in Tooling Scripts (`scripts/*.mjs`)        | Tooling scripts contain hardcoded `C:/Users/joshs` fallback paths.                                                                    | Replace hardcoded user home paths with dynamic `os.homedir()` / `process.cwd()`.                             | Resolved (#290)                          |

---

## §7.80 — Post-#316 Estate Reconciliation & 15 October Part 1 Remediations (15–16 October 2026)

### 1. Merged PRs Since §7.79 (#286–#316, through PR #316 `9e1e2ff4`)

- **PR #287 (`b8fd53d1`)**: Automated documentation maintenance pipeline (`npm run docs:maintain`) and `manifest.ts` `background_color` (`R7`).
- **PR #289 (`7debf591`) & PR #295 (`ef302b7e`)**: Cut `backend/ward-flow/` default primary store over to Supabase (`D-55`) and removed retired Azure runtime code.
- **PR #290 (`950fcac7`)**: Completed Streams 1–5 audit remediations (25 defect fixes across `S1-5`, `S1-7`, `S1-8`, `S1-9..S1-11`, `S2-3`, `S2-9`, `AUD-12`, `AUD-13`, `AUD-14`, `AUD-URL`, `AUD-ESC`, `M-WARD-ANSWER`, `D2`, `D3`, `D7`, `M-TOKENS`, `A3-8/A3-9`, `A3-15`, `A2-11/A2-12`, `A1-15`, `A4-12`, `A4-13`, `A4-15`, `R09`, `R14`, `SPEC-005`). Correction 21 Oct 2026: `CAP-REV` was listed here but #290 did not build it; requests cleared only on a local dismissal until branch `claude/project-thread-yu7210`.
- **PR #291 (`dc3b2b49`)**: Audit usability, accessibility, and reliability fixes (mandatory discharge blocker reason, dirty-state navigation guards `TASK-L6-01`, `M-WARD-ANSWER`).
- **PR #292 (`740446a2`)**: Top 25 clinical, operational, and UX improvements across Ward Flow screens.
- **PR #294 (`e5979207`)**: Source-generated `docs/FACTS.md` markers (`npm run docs:facts`) and `docs/retired-terms.json` enforcement.
- **PR #298 (`2c2f0fb6`)**: Wallboard TV mode for Board, Capacity, ED, and Command plus dedicated `/ward-flow/bed-meeting` page route (part of Ward Flow's **50 page routes** / **52 total app routes**).
- **PR #299 (`0bd40774`) & PR #307 (`53941021`)**: Random event sequence replay property/fuzz tests for reducer invariants, undo safety (`UNDO_LAST_ACTION`), delivering-stage arrival guard, and `aria-disabled` explanatory button conversion.
- **PR #300 (`85f6f7da`) & PR #316 (`9e1e2ff4`)**: End-to-end Playwright release gates for ED and inpatient transfer bed-flow journeys, plus fix for incoming transfer double-counting on Capacity (`A3-1`).
- **PR #303 (`395b2009`)**: Extracted 16 record and undo action handlers from `ward-flow-reducer.ts` into `ward-flow-record-handlers.ts` (`TASK-L6-03`).
- **PR #304 (`cac245bc`)**: October phone and PWA review fixes (including `manifest.ts` shortcuts `D5`, offline cache review `D4`, and trimming `statistics-polish.module.css` to a 22-line active layout wrapper).
- **PR #305 (`ccbb88c0`)**: Bounded Postgres connection pool and HTTP 500 vs 503 differentiation in `backend/ward-flow`.
- **PR #306 (`0cf7cf34`)**: Code quality review, file-size cap enforcement, and removal of dead `governance-screen.tsx` (`TASK-L1-13`).
- **PR #311 (`e096f6b3`)**: Patient Journey Drawer (`WardPatientDossierDrawer`) on the Coordinator screen.

### 2. Part 1 Remaining Fixes Completed on `feat/part1-remaining-fixes-20261016`

1. **`S2-9` (`ward-eligibility.ts` & `tests/ward-eligibility.test.ts`)**: Reconciled stale doc comments and pinned the intentional two-stage security gate contract between `eligibility()` (checks `unitHasLockedBeds(unit)` for `ACCEPT_IN_PRINCIPLE` waitlist capability while `PULL_PATIENT` enforces `lockedBedsFree(unit) > 0` via `locked_bed_capacity`) and `referralEligibility()` (requires `unitHasLockedBeds(unit) && lockedBedsFree(unit) > 0` for immediate placement matching).
2. **`M-TIME-01` (`global-search-preview.tsx`, `ward-global-search.tsx`, `record-preview.tsx`, `ward-form-times.tsx`, `tests/ward-simulation-clock-fallbacks.dom.test.tsx`)**: Connected `GlobalSearchPreview`, `RecordPreview`, and `WardFormTimes` to the simulation's `dayZero` and `now` clock via `useOptionalWardFlow()` and `perthCalendarDay(calendarDateOf(now, dayZero))` instead of raw browser wall-clock `new Date()`.
3. **`D5 / TASK-L1-03` (`src/app/manifest.ts` & `tests/ward-pwa-manifest.test.ts`)**: Enriched Ward Flow's PWA launcher shortcuts (`New referral`, `Alerts`, `Referrals`) with explicit `short_name` and `description` metadata and pinned them in `tests/ward-pwa-manifest.test.ts`.
4. **`AUD-12` (`ward-management-modes.tsx` & `tests/ward-landmarks.test.ts`)**: Moved `<h1 className="sr-only">{modeCopy[mode].title}</h1>` inside `<main id="main-content">` on `/network` and `/governance` so skip-link navigation reaches the page's primary heading landmark.
5. **`AUD-13` (`ward-tasks-drawer.tsx` & `tests/ward-tasks-drawer.dom.test.tsx`)**: Added scoped `Escape` key dismissal on the `<aside>` when `withBackdrop={false}` (`role="complementary"`) so the visible `Esc` badge works when focused inside the inline drawer without trapping Tab focus or hijacking global `window` Escape events.
6. **`STATIC-CLEAN / A4-7` (`public/capacity-table-mockup.html`, `public/referral-board-mockup.html`, `tests/ward-268-security-port.test.ts`)**: Removed the external `<script src="https://cdn.tailwindcss.com/3.4.17"></script>` tag from `public/capacity-table-mockup.html`, replaced it with self-contained inline CSS rules, added `<meta name="robots" content="noindex, nofollow" />` to both static HTML mockups, and tightened `tests/ward-268-security-port.test.ts` to forbid any external third-party `<script src="http...">` tag.
7. **`PERF-01 / TASK-L4-09` (`statistics/*.module.css` audit note)**: Verified that `statistics-polish.module.css` is actively imported by `src/app/ward-flow/statistics/layout.tsx:3` (already trimmed to 22 lines / 596 bytes in PR #304), while `statistics-v4.module.css` is pinned by 6 design-token contract test suites (`tests/statistics-v4-primitives-tokens.test.ts` asserts `raw.length > 8_000`) and the 4 `*-third-edition.module.css` files are touched by open PR #318 (`tests/statistics-third-edition-css.test.ts`).
8. **`AUD-A11Y-02 / TASK-L6-07` (`scripts/ward-flow/check-explanatory-buttons.mjs`, `package.json`, `tests/ward-explanatory-buttons-guard.test.ts`)**: Added the static regression guard script (`npm run check:explanatory-buttons`) and unit test suite ensuring no `<button>` combines native `disabled` with `aria-describedby`.
9. **`M-STATUS / M-HOSTING` (`docs/ward-flow/STATUS.md`, `docs/ward-flow/audit-2026-10-13-issue-triage.md`, `docs/ward-flow-task-ledger.md`)**: Reconciled baseline commits, route counts (**50** Ward Flow page routes / **52** total app routes per `docs/FACTS.md`), and merged PR status through PR #316 (`53941021`).

## §7.81 — Post-#316 Estate Reconciliation & 16 October Adversarial Audit Remediations (16 October 2026)

- **Merged PRs #317–#364 (`origin/main` at `5ddeb7d5`, PR #363, which merged after #364)**: Landed role-access scoping and shared desk idle lock (`WardAccessScope`, `WardIdleLock`), screen monolith decompositions across ED, Community, Referral Drawer, and Ward Screen (`fix list 2.5 and 9.6`), third-edition statistics CSS consolidation, and ledger/archive history split (`docs/ward-flow/archive/task-ledger-history-2026-08-to-2026-10-13.md`).
- **Adversarial Audit Remediation (`feat/adversarial-swarm-fixes-20261016`)**: Resolved the 10 verified defects and 4 hardening improvements across reducer undo/capacity/discharge-criteria invariants, `EdPatientDialog` top-layer closure before `ArrivalTimeModal`, `WardIdleLock` focus trapping (Escape no longer unlocks; only its button does), `CommunityScreen` `FD-13` contact modal honesty and keyboard shortcut guards, `ReferralConfirmation` drawer close on navigation, `WardBoard` `dispatchAndReport` wrapping and `resolveSubjectPatient` fallback, `.claude` worktree test guards, and baseline documentation sync through `5ddeb7d5` (PR #363). PR #365 review fixes: arrival support notifications stay with the receiving ward, a released bed also frees the referral arm's hold, cut arrivals leave the sex mix from their own recorded sex only, service desks see referrals from ED-only sites, and the role picker and break glass client from PR #363 replace this branch's duplicate.

### Audit-resolution documentation follow-up (R21, R28, R29, R30; 16 October 2026)

Local work from `c9f271a9` corrects the testing command/cadence and receipt claims, HAZ-05 source
references and the demonstration's selective governance-audit promise. The reference-pack checker
now verifies recursive membership as well as listed hashes, with only its own manifest excluded.
The two stale prose hashes were reviewed against #349's source diff (annotation/table formatting
changes only); reference/clinical facts and approval flags were not changed.

Focused omission tests fail on the old checker and pass after the repair. The read-only documentation
aggregate verified links, commands, facts, generated indexes and reference compilation; staleness
is advisory and not evidence of semantic correctness. These are local engineering observations,
not hosted CI, deployment, clinical approval or closure of unrelated audit findings.

### Integrated audit-resolution follow-up (all 44 retained IDs; 16 October 2026)

The same audit task now has a [six-workstream implementation plan](superpowers/plans/2026-10-16-audit-resolution.md)
and [complete per-issue resolution receipt](superpowers/plans/2026-10-16-audit-resolution-results.md).
The local branch `codex/resolve-audit-20261016` starts at `c9f271a9`, which already includes
PRs #365 and #366. It implements 34 findings, rechecks nine already-merged findings and retains
R43 as an upstream-blocked braces advisory. The receipt distinguishes focused regressions,
integrated verification and unavailable browser evidence. Final implementation/test head
`ed060984` passes the eight corrected suites (215 tests) and changed-file lint/typechecking hooks.
Full lint/typechecking passed on `9aca1c31`; that evidence and the separately recorded backend/HTTP
checks are reused, with only the eight reviewed test corrections afterward. A complete passing unit receipt remains outstanding: guarded reuse
was refused, and a fresh attempt was stopped after two unchanged tests timed out. The pinned
browser download and dashboard readiness also block required browser verification. R43 and these
verification limits remain explicit; no hosted PR status, CI verdict, publication or deployment
is implied.

Publication alignment on 17 October integrates verified main `7b14c988` after four real merge
conflicts. A fresh adversarial review identified and corrected command-result misclassification
when a separate permissions refresh fails or gates the desk; its targeted regression reproduced
the defect before passing. Focused shared-client and real PostgreSQL checks passed. The linked
receipt records the current open-PR overlap and retains the full-unit/browser verification limits.

Post-merge close-out, 17 October: PR #381 landed as `ed9d59e7`. Final integrated head `d5100884`
passed [Ward Flow CI #2533](https://github.com/BigSimmo/Ward-Flow/actions/runs/39000996265), including
all required components, eight unit shards and three browser groups. That hosted result supersedes
the earlier pending full-unit/browser and integration observations. Read-only Railway records show
the app, backend and shared frontend deployed from the merged commit; fresh authenticated browser
acceptance remains open because this execution environment blocks the hosted domain. The
[same resolution receipt](superpowers/plans/2026-10-16-audit-resolution-results.md#post-merge-close-out-and-remaining-acceptance--17-october-2026)
records the deployed identities, open PR overlaps and R43's unchanged upstream block and 22 October review.

## §7.82 — Decided owner questions from PR #383 review threads (17 October 2026)

Two product and privacy questions for Josh came out of the PR #383 review and are carried here instead of as open review threads. No code change has been made for either. Both were decided on 17 October 2026 (D-65) and are kept here only as a record.

1. **Decided. Community teams and typed discharge criteria**: should a community team on the patient's referral see the text of the patient-specific typed discharge criteria? Commit 678d14d took the safer default: the discharge record read gives a community team a numbered placeholder for each typed criterion, so counts and ticks still match the ward. Recommendation: keep the placeholders unless Josh wants community teams to read the text. Decided 17 October 2026: Josh accepted the recommendation, so the placeholders stay (D-65).
2. **Decided. Verified psychiatrist role for typed criteria**: should typed criteria need a verified psychiatrist role? Today "Set by the treating psychiatrist" is a self-ticked box that the ward and coordinator desks can send, as for the fixed D-60 criteria, and the app has no psychiatrist sign-in to check it. Recommendation: keep the attestation for the prototype and record a decision before any real use. Decided 17 October 2026: Josh kept the tick box for the prototype. D-65 now records that real use needs a real psychiatrist sign in.

## §7.84 — Remaining-ledger reconciliation and source fixes (24 October 2026)

Task/source identity: conversation `01a1684a-2d0a-7343-b88b-3e8c570335d0`, `BigSimmo/Ward-Flow`, branch `codex/ledger-integration-20261024`. This is a contribution to the existing ledger. Canonical Notion reconciliation remains pending; earlier completed and decided records are retained.

The source fixes were first committed as `590d388a56d7937af1588b82e736317c72260a81`. Current-main integration is against `cc51258ecb7b39acd016d0483b02978bf0f31a78`; use the PR for this branch for final-head validation and publication status. This dated receipt is not a hosted CI or deployment verdict.

- **Legal expiry:** a restored absent expiry no longer becomes zero and appear overdue. Finite recorded numeric values retain their meaning. Regression: `tests/ward-legal-expiry-restore.test.ts`.
- **Discharge dates and forecasts:** pending releases consistently use the current discharge plan across capacity, sources, bed-kind counts, levers and ED risk. Source disclosure distinguishes the current plan from the original release reporter. Completed history and raw records remain unchanged. Regressions include `tests/ward-beds-forecast.test.ts`, `tests/ward-beds-forecast-sources.test.ts` and `tests/ward-forecast-by-kind.test.ts`.
- **Community totals and minute labels:** headline and tab counts use the actual unfiltered queue; filtering narrows rows only. Explicit empty/live input does not fall back to demonstration data. Only minute values supported by the original design were corrected. Regressions: `tests/ward-community-demo-counts.dom.test.tsx` and `tests/ward-community-demo-time.test.ts`.
- **Escalation draft dismissal:** changed contact text receives discard confirmation across close, Escape, backdrop, replacement drawer, subject switching and navigation. Cancellation preserves the draft; accepted discard clears it without duplicate prompts. Regression: `tests/ward-tasks-dismissal.dom.test.tsx`.
- **Statistics loading:** accessible, reserved-space fallbacks are implemented for the existing lazy Journey and Map panels. Two focused files / five tests passed. Browser checks at 1280px verified both pending views, unique anchors, one loading status, 384px minimum panel space, switching while pending and replacement by the loaded panels. At 390px the existing phone summary has no Journey/Map controls; its layout had no horizontal overflow.
- **Documentation:** stale present-tense CSS comments were corrected without changing styling. Main's newer generated route-count wording is retained. SEC-003 / R43 / QF-10 was closed by upstream withdrawal of GHSA-vfj7-8cjw-p6xm on 23 October, without a dependency upgrade or claim of a new package audit; dated evidence remains in `dependency-security-exceptions.md`.
- **Reconciled historical concerns:** the legacy RecordPreview is hidden and inert while active search uses the shared Drawer; the old click-away patch is not required. The reducer already has substantial domain extraction. Unreferenced application CSS still referenced by tests was retained. Historical WA candidates and Settings implementation are not treated as newly reproduced defects.

Verification recorded so far: the first committed candidate passed the full unit gate (1,342 files, 15,044 executed tests, seven existing skips), lint, typecheck, documentation and offline backend checks (210 passed, 17 real-PostgreSQL tests skipped). After the first main integration, 14 interaction files / 192 tests and the documentation pipeline passed. The equal-date attribution follow-up reproduced six failures before repair and passed 20 tests afterwards; matching dates retain separate current-plan and release-report attribution. These are separate input identities; they do not establish final-head readiness. Use the final PR checks and same-task receipt for the selected gate results.

Acceptance requires production build and Ward journeys for the final candidate. Other work retains its own evidence: the existing phone-budget/performance tasks; physical Safari and installed-PWA checks; authenticated hosted save/reload/conflict; deployed runtime and saved-cloud toolchain acceptance; historical all-route/Settings/WA handover acceptance; and external-client instruction loading. Local, hosted CI, publication, merge and deployment are separate states. No live database, merge into main or deployment is included in this task's PR authority.
