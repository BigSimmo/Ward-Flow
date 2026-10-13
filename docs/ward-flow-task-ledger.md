# Ward Flow — The Task Ledger

> **Authoritative Task Ledger — Current as of 13 October 2026.**
> This document is the single authoritative source of truth for Ward Flow tasks, engineering milestones, and governance gates.
> 
> - **What this is:** Active, completed, deferred, and parked tasks for the Ward Flow prototype.
> - **What this is NOT:**
>   - `docs/outstanding-issues.md` is the **repository's general ledger** (529 rows, separate `/issues` intake); never mix prototype tasks into it.
>   - `docs/ward-flow-ledger.md` is the **Decisions Register** (where decisions D-01 to D-37 live); cite it, do not restate it.
>   - `docs/ward-flow/STATUS.md` is the **executive high-level status summary**.
>
> **Prototype Operating Principles:**
> 1. **100% Synthetic Demonstration Data:** Zero live electronic health record (EHR) connections, zero real patient information, zero automated clinical decision-making.
> 2. **Clinician Always in the Loop:** The system never algorithmically allocates a bed or overrides clinical gatekeeping. It illuminates options and records human rationale.
> 3. **Truthful Denominators ("Stop the claim, keep the facts"):** The software never displays what data cannot support—no computed legal expiry deadlines, no phantom ready beds, and clear distinctions between "unrecorded" and "zero".

---

## 1. Executive Status & Test Proof Summary (13 October 2026)

- **Upstream Baseline (`origin/main` at PR #258, commit `0ddcf956`):**
  - **CI Status:** 100% green across all 13 hosted GitHub Actions jobs (5 parallel unit shards, 3 Playwright browser lanes, whole-tree ESLint, production build, Gitleaks secret scan).
  - **Expected Reds Manifest (`tests/ward-expected-reds.json`):** `expected: []` (0 expected reds; zero failing tests across >10,400 assertions).
  - **Architectural Elevation:** Landed complete **v6 architecture overhaul** (PRs #109–#115), phone-first mobile responsive overhaul (#122, #125), two-way Figma token synchronization (#121), referral slide-out (#136), coordinator-only shared PostgreSQL prototype backend (#133), drawer interaction stabilization (#248), and capacity request lifecycle (#258).
- **Comprehensive Multi-Stream Appraisal (13 October 2026):**
  - Reconciled every single outstanding issue identified across Audit Chat (`f207b41e`) and Issues Chat (`c1d802b0`), incorporating clinical psychiatric governance (*Mental Health Act 2014* statutory compliance, physical bed conservation, acute ambulance handovers, clinical authority) and software engineering resilience.
  - 42 of the original 52 canonical issue families are **100% Completed & Verified**.
  - 5 families were **Formally Resolved & Deferred** by explicit owner decisions D-30 through D-35.
  - 8 families are **Parked Pre-Pilot Hard External Gates** ratified in Decisions D-36 and D-37.
  - Active and newly appraised items are comprehensively indexed across Tracks 1–7 below.

---

## 2. The 14 Whole-Journey Invariant Properties (I-01 to I-14)

All tasks, reducers, and screens strictly enforce 14 non-negotiable architectural and clinical invariants:

- **`I-01: Identity Monotonicity`**: A patient journey preserves its immutable `patientId`, `movementId`, and referral provenance across all stage transitions. No operational event may create duplicate or orphaned identity handles.
- **`I-02: Conservation of Physical Bed Capacity`**: Bed arithmetic is zero-sum. Allocating a bed decrements available capacity by exactly 1; discharging or releasing refunds exactly 1. Double-crediting or double-decrementing is strictly forbidden.
- **`I-03: Single-Active-Journey Invariant`**: A patient cannot have multiple concurrent active inpatient movements. An admission cannot exist without an active movement, and a movement cannot point to a deleted admission.
- **`I-04: Transport-Readiness Decoupling`**: A transport cancellation (`CANCEL_TRANSPORT`) cannot automatically generate a phantom replacement booking, nor advance clinical readiness (`handover_ready`) without explicit clinical confirmation.
- **`I-05: Non-Reversible Physical Milestones`**: Physical events that occurred in the real world (vehicle departure, patient arrival on ward) cannot be erased via administrative stage rollback (`STEP_BACK_STAGE`). Rollbacks must record compensatory corrections.
- **`I-06: Acuity-Staffing Feasibility Gate`**: A high-acuity patient cannot be allocated or pulled to a ward unless `remainingHighAcuityCapacity >= 1` at the exact instant of pull, preserving safe nurse-to-patient staffing ratios.
- **`I-07: Front-Door Terminal Withdrawal`**: When a referrer withdraws a referral (`WITHDRAW_REFERRAL`), the journey terminates immediately. Stale pending referrals cannot be accepted or answered after withdrawal.
- **`I-08: Community Autonomous Decision Gate`**: Community mental health teams have full, independent authority to accept or decline referrals (`ACCEPT_COMMUNITY_REFERRAL`). Community decisions must not be locked out of the permissions matrix.
- **`I-09: Universal Milestone Timestamp Truthfulness`**: Event timestamps must record true occurrence time. Clocks comparing durations must read the same temporal source. Clocks must stop upon physical arrival.
- **`I-10: Statutory Mental Health Act Form Authority`**: Involuntary detention orders (Form 1A, 3A, 4A, 6A, 7A) must track strict statutory deadlines under the WA Mental Health Act 2014. Expiries must trigger clinical alerts without automated software detention claims.
- **`I-11: Cross-Ward D-14 Default-Deny Privacy Barrier`**: Wards may never inspect where else a patient was referred or view cross-ward movement histories. Direct `.patientId` link reads outside the strict D-14 allowlist are prohibited.
- **`I-12: Zero-Timestamp Robustness`**: A valid timestamp of `0` (or epoch start) must be treated as a valid milestone, not coerced to `undefined` or falsy.
- **`I-13: Temporal Window Realism`**: Capacity projections must cleanly distinguish between rolling 24-hour horizons and calendar-day boundaries, preventing time-travel bugs across midnight.
- **`I-14: Immutable Historical Timeline Provenance`**: Historical timeline entries (Command Activity) must preserve the clinical urgency and status as it existed when the event occurred, never dynamically rewriting history from mutable current state.

---

## 3. The 60 Canonical Issue Families & Estate Extensions (WF-01 to WF-60)

| ID | Title | Priority | Status (9 Oct 2026) | Decisive Implementation / Test Proof |
| :--- | :--- | :---: | :---: | :--- |
| `WF-01` | Reconcile examination closure with admission, reservation & transport | P1 | **Completed & Verified** | Pulled-bed orphan fixed (`ward-flow-reducer.test.ts:1001`); Flight Deck (#69) integrates examination, admission, and transport lifecycle. |
| `WF-02` | Guard operational actions against surviving commitments after stage correction | P1 | **Completed & Verified** | Step-back bed preservation proven across starting stages and destination resets (`ward-audit-engine-fixes-2026-09-16.test.ts`, 16/16 pass). |
| `WF-03` | Verify remaining high-acuity staffing at allocation | P1 | **Completed & Verified** | Bed pull feasibility strictly enforces `remainingHighAcuityCapacity` with recorded clinician overrides (`ward-acuity-gate.test.ts`). |
| `WF-04` | Separate cancellation, replacement booking and handover readiness | P1 | **Completed & Verified** | Cancelling at pulled stage decouples handover readiness; transport-readiness decoupling fully guarded (Invariant `I-04`). |
| `WF-05` | Define destination change and diversion after reservation or collection | P1 | **Completed & Verified** | Implemented `RECORD_DIVERSION` and `RELEASE_DIVERTED_BED`; reroutes active journey and cleans up prior bed hold (Decision D-01). |
| `WF-06` | Count one physical departure once across admission and bed-release paths | P1 | **Completed & Verified** | Invariant `I-05` enforced; `departAdmission` and `RELEASE_BED` turnover paths linked to eliminate duplicate credits. |
| `WF-07` | Validate runtime events and define capacity reconciliation | P1 | **Completed & Verified** | Integer, non-negative, and bounded range runtime validation enforced on `CONFIRM_CAPACITY` in reducer. |
| `WF-08` | Prevent an old capacity draft overwriting a newer observation | P1 | **Completed & Verified** | Optimistic concurrency checking enforces `expectedRevision` on capacity confirmation events, rejecting stale drafts. |
| `WF-09` | Preserve patient/referral provenance and intended-episode uniqueness | P1 | **Completed & Verified** | Episode identity monotonicity (`I-01`) preserved; `referralId` and `homeRegion` retained through bed pull and admission transitions. |
| `WF-10` | Deliver recipient-scoped notices that survive active-row removal | P1 | **Completed & Verified** | Persistent notices stored in immutable Activity timeline; mark-read tracking and severity filtering integrated in drawers (PR #70). |
| `WF-11` | Make parallel-referral add, replace and withdraw semantics explicit | P2 | **Completed & Verified** | Additive parallel referrals supported across independent services without cross-ward leak; withdrawal/decline semantics verified. |
| `WF-12` | Complete community decisions and independent referral purposes | P1 | **Completed & Verified** | Community teams have autonomous decision authority to accept or decline referrals (`ward-flow-events.ts`, PR #24, PR #49; Invariant `I-08`). |
| `WF-13` | Make front-door withdrawal terminal for pending decisions | P1 | **Completed & Verified** | Front-door self-withdrawal terminates pending allocation across movement and referral reducers (`WITHDRAW_REFERRAL`, PR #49; Invariant `I-07`). |
| `WF-14` | Provide truthful all-declined and no-admission exits | P2 | **Completed & Verified** | All-declined referrals return truth-tracked to coordinator queue with explicit non-admission status (`ward-referral-drawer.tsx`, PR #49, PR #70). |
| `WF-15` | Represent direct community/ward origins and inter-ward transfers | P2 | **Resolved & Deferred** | Enforced central coordinator role gate for inter-ward transfer acceptance (Decision D-30, PR #117); direct clinic referrals deferred to Phase 2. |
| `WF-16` | Complete a no-booked-transport-needed journey | P1 | **Completed & Verified** | Direct arrival supported when no transport is required (`ward-transport-not-needed.test.ts`, 4/4 pass; Decision D-02). |
| `WF-17` | Allow reassessment and changing clinical decisions | P2 | **Completed & Verified** | Reassessment and changing decisions supported with explicit audit provenance; medical clearance re-evaluation active (PR #69). |
| `WF-18` | Complete discharge dependencies and accountable community follow-up | P2 | **Completed & Verified** | Discharges board overhaul (PR #45, #66) tracks discharge blockers and links accountable community follow-up teams. |
| `WF-19` | Connect temporary ED attendance to a named location and responsible service | P2 | **Completed & Verified** | Away-at-ED events name responsible service and department location; individual ED psychiatry screen polished (PR #71). |
| `WF-20` | Link leave-bed handling to an admission and leave episode | P2 | **Completed & Verified** | Leave beds explicitly linked to active admission episode; leave return preserves bed reservation. |
| `WF-21` | Agree reservation expiry and handover snapshot semantics | P2 | **Completed & Verified** | `pullExpiresAt` TTL expiration and renewal semantics implemented (Decision D-08). |
| `WF-22` | Render or clear a closed coordinator selection coherently | P2 | **Completed & Verified** | Selection re-resolution coherently drops closed records across all views, deep links, and drawers (PR #70). |
| `WF-23` | Avoid accepted cases appearing as declined by all | P2 | **Completed & Verified** | `handoverSnapshot` precedence logic verified; accepted status overrides prior preliminary declines. |
| `WF-24` | Preserve the intended date in time-only inputs | P1 | **Completed & Verified** | Date context preserved across all time-entry controls and bed-release workflows. |
| `WF-25` | Separate occurrence, recording, update and verification times | P2 | **Completed & Verified** | Invariant `I-09` verified; separate timestamps recorded for clinical occurrence, event dispatch, and state update. |
| `WF-26` | Verify physical consistency of the scarce scenario | P2 | **Completed & Verified** | Scarce scenario bed allocations reconciled against physical bed definitions and verified by automated seed tests. |
| `WF-27` | Verify the replacement Capacity and Delays controls | P2 | **Completed & Verified** | Overhauled with accessible fold states, action runway, and 3 visual analytics views (PR #47, #54, #67, #68). |
| `WF-28` | Resolve the Morning route’s frozen-versus-live contract | P2 | **Completed & Verified** | Morning bed-meeting sheet (PR #54) provides 09:30 snapshot; Tomorrow's beds forecast (PR #55, #61) delivers rolling 24h prediction. |
| `WF-29` | Establish privacy and genuine service-scoped authority | Gate | **Parked Pre-Pilot Gate** | D-14 default-deny barrier verified (16 allowlisted files); 4-tier RBAC posture ratified in D-37; live Entra ID auth parked per D-36. |
| `WF-30` | Govern sensitive demographic display and decision use | Gate | **Resolved & Deferred** | Resolved in Decision D-31: Algorithmic automatic placement deferred; gender eligibility checks preserved with clinician override safety. |
| `WF-31` | Validate legal forms, authority and deadline provenance | Gate | **Parked Pre-Pilot Gate** | Advisory Notice Only doctrine ratified in D-37 (zero auto-detention); MHA statutory deadlines isolated to synthetic demo (`act-periods-demo.ts`, PR #52). |
| `WF-32` | Agree ranking, urgency and waiting-time policy | Gate | **Resolved & Deferred** | Resolved in Decision D-32: Emergency referrals sort strictly by FIFO waiting time with ATS triage badges (1–5); automated urgency re-sorting deferred (PR #118). |
| `WF-33` | Provide authoritative persistence, concurrency and recovery | Gate | **Parked Pre-Pilot Gate** | Backend persistence and optimistic concurrency code-complete; local JSON scenario save/load active (PR #50); cloud DB parked per D-18/D-36/D-37. |
| `WF-34` | Make tests discriminate real workflow failures and current route behaviour | P1 | **Completed & Verified** | Test suites discriminate real workflow failures; shard rebalancing and contract checks green across 5 CI shards (PR #78). |
| `WF-35` | Align architecture notes and remediation guidance with current code | P2 | **Completed & Verified** | Screen verification manifests and code maps reconciled and synchronized with current components. |
| `WF-36` | Require an actually ready resource of the appropriate kind | P1 | **Completed & Verified** | System-wide bed taxonomy standardized across all screens to four mutually exclusive states: Ready, Pulled, Closed, Occupied (PR #58). |
| `WF-37` | Reconcile the booked job when releasing its reservation | P1 | **Completed & Verified** | Reservation release cleans up associated uncollected transport jobs across all movement paths. |
| `WF-38` | Retain the reasons for actually applied acceptance/pull overrides | P2 | **Completed & Verified** | Placement override reasons retained in audit logs and displayed on explainable placement shortlist (PR #58). |
| `WF-39` | Treat valid zero timestamps as present | P2 | **Completed & Verified** | Invariant `I-12` verified; epoch-zero timestamps handled robustly across all reducers without false absence. |
| `WF-40` | Tie preparation to a current turnover identity | P2 | **Completed & Verified** | Bed preparation explicitly associated with current turnover record and departing admission identity. |
| `WF-41` | Decide which local ward entries become shared operational facts | P2 | **Resolved & Deferred** | Resolved in Decision D-33: Local nursing and medical shift notes confined strictly to local ward view; only operational telemetry publishes statewide. |
| `WF-42` | Separate transport arrival from receipt and responsibility | P1 | **Completed & Verified** | Transport arrival decoupled from clinical handover receipt; Handover Command Horizon (PR #42, #72) provides dedicated nurse handover verification. |
| `WF-43` | Provide change-sensitive readiness and owned exception recovery | P1 | **Resolved & Deferred** | Resolved in Decision D-34: Acute medical deterioration bed release and cancellation protocol formalised with dedicated audit tags. |
| `WF-44` | Maintain a verified service and catchment directory | Gate | **Parked Pre-Pilot Gate** | Public WA Health directory live for demonstration; Advisory Directory standard ratified in D-37; clinic phone audit parked per D-36. |
| `WF-45` | Scope regional multi-leg transport and repatriation | Later | **Resolved & Deferred** | Formally deferred in Decision D-35: Regional aeromedical multi-leg patient journeys (RFDS + secondary ambulance) deferred to post-pilot regional expansion. |
| `WF-46` | Establish clinical safety ownership and controlled pilot governance | Gate | **Parked Pre-Pilot Gate** | Clinical Safety Case baseline ratified in D-37 (`CLINICAL-SAFETY-CASE.md`, HAZ-01–05 mitigated); external CSO appointment scheduled pre-pilot per D-36. |
| `WF-47` | Define truthful flow analytics and measure benefit | Later | **Completed & Verified** | All seven Statistics dashboard screens polished with unified occupancy math (`tests/ward-statistics-occupancy.test.ts`, 2/2 pass; PR #74). |
| `WF-48` | Maintain a capability register and staged enhancement backlog | P2 | **Completed & Verified** | Staged enhancement backlog maintained; task ledger reconciled across PRs #1–#127. |
| `WF-49` | Do not rewrite historical Activity facts from current mutable state | P2 | **Completed & Verified** | Invariant `I-14` verified; immutable Activity timeline notices preserved with original event provenance (PR #70). |
| `WF-50` | Give community screens a truthful role and task context | P2 | **Completed & Verified** | `WardChromeRole` sets explicit "community" role context; community directory and gateway screens aligned (PR #24, PR #66). |
| `WF-51` | Remove the unproved placement guarantee from aggregate capacity copy | P2 | **Completed & Verified** | Replaced unprovable guarantee copy `"nobody goes without today"` with `"net available capacity today"` (`ward-zero-gap-capacity-copy.test.ts`, 3/3 pass; PR #81). |
| `WF-52` | Stabilise local server/cache verification without disturbing other sessions | P2 | **Completed & Verified** | `npm run ensure` isolates local dev server ports and prevents session crosstalk. |
| `WF-53` | Aboriginal cultural safety review | Gate | **Parked Pre-Pilot Gate** | Aboriginal Cultural Safety Charter ratified in D-37 (`ABORIGINAL-CULTURAL-SAFETY-CHARTER.md`); independent external review scheduled pre-pilot per D-36. |
| `WF-54` | Medical device (TGA / SaMD) classification status | Gate | **Parked Pre-Pilot Gate** | TGA Clinical Decision Support Software exemption position ratified in D-37 (Therapeutic Goods Regs Sch 4 Pt 2 exempt; no auto-allocation); formal filing parked per D-36. |
| `WF-55` | Privacy review (external assessment) | Gate | **Parked Pre-Pilot Gate** | Privacy Architecture Standard ratified in D-37 (100% synthetic isolation, data minimisation); external legal PIA scheduled during hospital IT onboarding per D-36. |
| `WF-56` | WA legal advice on forms and statutory time limits | Gate | **Parked Pre-Pilot Gate** | Advisory Notice Only doctrine ratified in D-37; warning-only display adheres to recorded clinician dates; formal Crown Law review scheduled pre-pilot per D-36. |
| `WF-57` | Post-incident review scope | Gate | **Parked Pre-Pilot Gate** | PIR Immutable Telemetry Specification ratified in D-37 (Invariants I-01–I-14 append-only event ledger; single-click PIR export standard); forensic audit scheduled pre-pilot per D-36. |
| `WF-58` | Deferred 17 Sept items resolved or tracked across estate PRs | Later | **Completed & Verified** | All seven deferred items resolved across PRs #5, #42, #50, #54, #66, #72. |
| `WF-59` | Patient record 7-stage journey stepper & timeline alignment | P2 | **Completed & Verified** | Fully implemented and merged in PR #69 (`patient-now-screen.tsx`, `usePatientNow`, `patient-tracker-facts.tsx`; `ward-patient-flight-deck.dom.test.tsx`, 6/6 pass). |
| `WF-60` | Guided ten-minute "day in the life" demo script on synthetic data | Later | **Completed & Verified** | Authored comprehensive 10-minute guided demonstration script in `docs/ward-flow/DEMO-SCRIPT.md` covering all 5 clinical acts across WA Health facilities on synthetic data (PR #81). |

---

## 4. Landed Estate Milestones (PR #65 through PR #127)

### §7.70 · Universal Curved Prototype Banner & Symmetrical Master Search Hub (PR #65, #66)
- **Delivered:** Standardized single `<WardPrototypeFooter>` across every estate screen with floating curved pill styling. Centered search composer on Hub with quick-jump target pills. Direction 3 Floating Glass Command Horizon on Patient Search. Discharges board overhaul with wave runway and sticky table header. Bed dossier drawer extraction.
- **Verification:** 84/84 hub tests, 93/93 community tests, 107/107 telemetry tests, 85/85 chrome header tests passing.

### §7.71 · Unified Patient Now Flight Deck & 7-Stage Stepper (WF-59, PR #69)
- **Delivered:** Consolidated `/people/[patientId]` and `/movements/[movementId]` onto a unified clinical flight deck. 7-stage live journey stepper (Referral Created, Triage Accepted, Bed Allocated, Transport Booked, In Transit, Arrived at Ward, Admission Complete). 5-tab governed dossier (Clinical, History, Community, Details, Documents).
- **Verification:** 285 tests across 12 suites (`ward-patient-flight-deck.dom.test.tsx`, `ward-patient-now-screen.dom.test.tsx`, etc.); zero WCAG 2.1 AA violations.

### §7.72 · Handover Command Horizon 3-Tier Flight Deck & Print Engine (PR #42, #72)
- **Delivered:** 3-tier Command Horizon architecture (Hero Header, Borderless Telemetry Deck, Clean Action Toolbar with Shift Switcher). Dark hero and telemetry panels force `CanvasText` foreground and neutral backgrounds under `@media print`.
- **Verification:** 10 focused suites passed (`ward-handover.dom.test.tsx`, `ward-handover-print.test.ts`, etc.).

### §7.73 · Individual ED Psychiatry Screen Polish & Typography (PR #71)
- **Delivered:** Third-edition curved ED header integrating census telemetry and bed pressure metrics. Modularized attention pane highlighting acute presentations and prolonged waits. 9-column clinical table with days/hours wait formatting.
- **Verification:** 147 assertions in `ward-ed-polished.dom.test.tsx` passed.

### §7.74 · Estate-Wide Seven-Screen Statistics Dashboard Polish (PR #74)
- **Delivered:** Preserved all seven statistics surfaces (Statewide, Service Breakdown, Ward Statistics, ED Psychiatry, Community Teams, Compare, Network Overview). Unified occupancy calculation engine (`Occupied / Total Operational Beds`). Sortable tables, CSV export, and readable days/hours formatting.
- **Verification:** `ward-statistics-occupancy.test.ts` (2/2 pass), `ward-pr15-review-regressions.dom.test.tsx` passed.

### §7.75 · Unit Test Shard Rebalancing & CI Optimization (PR #37, #75–#78)
- **Delivered:** Parallel unit shard coverage recording with downstream merged report. Main CI verdict reuse guard (`scripts/ward-ci-public/main-reuse.mjs`). Isolated Next.js build cache from `main`. Full-tree linting on every PR. Playwright Chromium caching. Shard duration variance reduced from 1.36x to 1.08x, reducing PR CI from ~17m to <4m.
- **Verification:** 169/169 tests in `ward-ci-main-reuse.test.ts` passed.

### §7.76 · Estate Audit Resolution, WF-51 Zero-Gap Copy Fix & WF-60 Demo Script (PR #81)
- **Delivered:** Replaced unprovable guarantee copy `"nobody goes without today"` with `"net available capacity today"` (WF-51). Authored comprehensive 10-minute guided demonstration script across 5 clinical acts in `docs/ward-flow/DEMO-SCRIPT.md` (WF-60). Codified clinical decisions D-30 to D-36 in `docs/ward-flow/decisions.md`.
- **Verification:** `tests/ward-zero-gap-capacity-copy.test.ts` (3/3 pass), full typecheck 0 errors.

### §7.77 · Adversarial Remediation & Privacy Hardening (PR #83, #84, Commits `3299926`–`d4cd47d`)
- **Delivered:** Enforced D-30 central coordinator role gate for inter-ward transfers (`ward-flow-reducer.ts`). Emergency referral queue sorted strictly by FIFO waiting time per D-32 (`ward-referrals.ts`). Statutory MHA form renewal wording aligned to advisory terms ("Record Form Renewal" / "Record Paper Extension") per D-22 and D-37. Drawer open/close state synced with URL search parameters (`?drawer=<id>`). Upholds Decision D-18 privacy ("typed text stays off the device") by eliminating `sessionStorage` free-text caching in `useDirtyStateGuard.ts`.
- **Verification:** `tests/ward-care-journey.test.ts` (62/62 pass), `tests/ward-referral-model.test.ts` (52/52 pass), `tests/ward-use-dirty-state-guard.dom.test.tsx` (4/4 pass).

### §7.78 · v6 Architecture Overhaul & Design System Kit (PRs #109–#115, #85–#105)
- **Delivered:** Complete v6 design architecture deployed across all estate screens:
  - Tokens, shared components, header, sidebar, and floating drawers (PR #109).
  - Patients group screens: Patients, Patient Now, Referrals, New referral, Add patient, Legal forms (PR #110).
  - Oversight group screens: Alerts, Discharges, Handover, Delays, Governance, On-call, Showcase (PR #111).
  - Wards and capacity group screens: Wards, Capacity, Places, Network, Emergency, Ward, Ward answer, Bed board (PR #112).
  - Core group screens: Home, Movements, Settings, Sign in, Work mode (PR #113).
  - Community, transport, and statistics group screens (PR #114).
  - Kit follow-up: phone tap targets, accessible refs, checkable menu items, chart scaling (PR #115).

### §7.79 · Responsive Mobile Phone Overhaul (PR #122, #125)
- **Delivered:** Comprehensive phone-first mobile responsive overhaul:
  - Single locked header bar on phone viewports with compact status telemetry (PR #122).
  - Every core screen optimized to fit mobile viewports without horizontal scrolling (PR #122).
  - Desktop viewports strictly unchanged while polishing every phone screen layout and tap targets (PR #125).

### §7.80 · Two-Way Figma Token Synchronization (PR #121)
- **Delivered:** Two-way Figma design token synchronization pipeline:
  - Synchronized color palettes, typography scales, spacing tokens, and border radii.
  - Automated token extraction and validation scripts in `scripts/`.
  - Maintained bidirectional alignment between Figma design specs and CSS module variables.

### §7.81 · Core Technical Bug Salvage & Lint Hardening (PR #116, #119, #120, #124, #127)
- **Delivered:** Salvaged genuine technical fixes from historical audit PRs #106, #107, #108 into PR #116. Fixed core admission, persistence, and Settings bugs (PR #120). Corrected demo script storage and recovery claims (PR #119). Maintained documentation repaired and lint blockers cleared (PR #124). Sidebar polish: one-line bed alerts, clearer section titles, smaller policy line (PR #127).

---

## 5. Active Task Ledger & Remaining Backlog

### Track 1: Immediate Clinical Authority, Safety & Statutory Boundaries (Immediate Actionable)
*These issues govern clinical decision-making permissions, real-world privacy risks, and statutory compliance under the Mental Health Act 2014 (WA).*

- [ ] **WF-AUD-01: Replace Real WA Hospital Phone Number in Movement Drawer**
  - **Location:** [`src/components/ward-management/movements/movement-drawer.tsx:577`](file:///d:/Repos/Ward-Flow/src/components/ward-management/movements/movement-drawer.tsx#L577)
  - **Clinical Appraisal:** Fremantle Hospital's actual main switchboard number (`08 9431 3333`) is hard-coded into an emergency contact button launching `window.location.href = "tel:..."`. Dialing it during a live demo connects to a real hospital emergency switchboard.
  - **Action:** Replace `08 9431 3333` with the reserved Australian synthetic demonstration number `08 5550 1234` and use an accessible `<a href="tel:0855501234">` element.

- [ ] **WF-09A: Fix Involuntary Inpatients Mislabeled as "Voluntary / Informal"**
  - **Location:** [`src/components/ward-management/movements/movement-drawer.tsx:649-653`](file:///d:/Repos/Ward-Flow/src/components/ward-management/movements/movement-drawer.tsx#L649-L653)
  - **Clinical Appraisal:** If an involuntary patient has no explicit statutory form attached in state, line 652 silently defaults their badge to "Voluntary / Informal". Misidentifying an involuntary patient creates an immediate risk of unescorted departure or AWOL incident.
  - **Action:** Check `movement.legalStatus` first. If `movement.legalStatus === 'Involuntary inpatient'`, badge them as Involuntary regardless of whether `legalForm` is populated.

- [ ] **WF-S2-2: Hard-Code Statutory Hold Immunity on Revoked Examination**
  - **Location:** [`src/components/ward-management/movements/movement-drawer.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/movements/movement-drawer.tsx) & [`src/components/ward-management/ward-flow-reducer.ts`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward-flow-reducer.ts)
  - **Clinical Appraisal:** Under MHA 2014, when an involuntary examination order is revoked, the patient cannot be lawfully held or transferred without a fresh clinical assessment. Clearing a free-text blocker note currently clears the `examRevoked` hold flag, risking unlawful transfer.
  - **Action:** Enforce statutory hold immunity: `examRevoked` hold state must only be cleared by an explicit clinical re-referral or doctor reassessment event (`RECORD_EXAMINATION`), never as a side-effect of editing general notes.

- [ ] **WF-A1-2: Enforce Ownership Authority on Referral Cancellation**
  - **Location:** [`src/components/ward-management/ward-flow-reducer.ts:WITHDRAW_REFERRAL`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward-flow-reducer.ts)
  - **Clinical Appraisal:** Inpatient ward nurses or community clinicians can currently invoke `WITHDRAW_REFERRAL` to cancel an ED's acute referral. Receiving wards should only *decline* an intake; only the referring ED team (or central coordinator with consent) has authority to *withdraw*.
  - **Action:** Enforce ownership validation in reducer: `WITHDRAW_REFERRAL` must verify `caller.placeId === referral.originSiteId` or `caller.role === 'coordinator'`. Receiving wards attempting to cancel are routed to "Decline referral".

- [ ] **WF-A1-5: Legal Form Modification Attribution & Audit Logging**
  - **Location:** [`src/components/ward-management/legal/legal-forms-screen.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/legal/legal-forms-screen.tsx)
  - **Clinical Appraisal:** Any role can currently edit statutory MHA form expiry dates and detention statuses without capturing clinician identity or audit history. Form extensions require statutory authority.
  - **Action:** Retain open demo editing, but add attribution prompt: *"Recorded by: [Clinician Name / Designation]"* and log an immutable entry into `Command Activity` under Invariant `I-14`.

- [ ] **WF-AUD-02: Normalize Windows Drive-Letter Casing in Push Guards**
  - **Location:** [`scripts/guard-push.mjs:1814`](file:///d:/Repos/Ward-Flow/scripts/guard-push.mjs#L1814) & [`scripts/check-ward-data.mjs:945`](file:///d:/Repos/Ward-Flow/scripts/check-ward-data.mjs#L945)
  - **Engineering Appraisal:** On Windows, Node represents paths as `D:\Repos...` or `d:\Repos...`. Case-sensitive matching with `import.meta.url` fails, causing pre-push scripts to exit with code 0 without running security, format, or test gates.
  - **Action:** Normalize paths case-insensitively using `path.resolve(process.argv[1]).toLowerCase()` on `win32`.

- [ ] **WF-AUD-04: WardDailySheet Live Clock Fallback (Eliminate Epoch 0 / 56-Year Stay Bug)**
  - **Location:** [`src/components/ward-management/board/ward-daily-sheet.tsx:384`](file:///d:/Repos/Ward-Flow/src/components/ward-management/board/ward-daily-sheet.tsx#L384)
  - **Clinical Appraisal:** In `WardBoard`, `WardDailySheet` is mounted without passing `now`. The component falls back to `0` (1 Jan 1970). Stay durations display as "56 years" and departure horizons crash.
  - **Action:** Query `const clockNow = useWardFlowClock()` inside `WardDailySheet` and use `const currentNow = now ?? clockNow`.

- [ ] **WF-AUD-05: Milestone Timestamp Check for In-Transit Bed Hold Protection**
  - **Location:** [`src/components/ward-management/ward-referrals.ts:1473`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward-referrals.ts#L1473)
  - **Clinical Appraisal:** The helper checks `(movement.transport as any).stage === 'in_transit'`. `TransportJob` has no `stage` property; it records timestamps (`bookedAt`, `enRouteAt`, `arrivedAt`). The check always evaluates to `false`, causing active ambulance journeys to trigger false bed-expiry alarms.
  - **Action:** Replace check with `if (movement.transport?.enRouteAt && !movement.transport?.arrivedAt) return false;`.

- [ ] **WF-AUD-07: Reset Placement Clinical Notes on Shortlist Patient Switch**
  - **Location:** [`src/components/ward-management/coordinator/shortlist-panel.tsx:555`](file:///d:/Repos/Ward-Flow/src/components/ward-management/coordinator/shortlist-panel.tsx#L555)
  - **Clinical Appraisal:** Switching between patients retains the previous patient's entered gender-placement justification in React state, risking submission of sensitive notes under the wrong patient profile.
  - **Action:** Clear `genderPlacementReason` whenever `movement?.id !== confirmationMovementId`.

- [ ] **WF-A4-5: Public Prototype Demonstration Authentication Gating**
  - **Location:** [`src/app/mockups/ward-flow/`](file:///d:/Repos/Ward-Flow/src/app/mockups/ward-flow)
  - **Engineering Appraisal:** `/mockups/ward-flow` is mounted without authentication in production builds. Public exposure risks unindexed search crawling or confusion with genuine WA Health portals.
  - **Action:** Add environment check in `middleware.ts` / root layout: restrict demo routes behind basic auth or demonstration passphrase when deployed to public domains.

---

### Track 2: Bed Allocation, State Machine & Invariant Hardening
*These issues protect truthful bed capacity arithmetic, transport handovers, and role permissions.*

- [ ] **WF-A3-02 & WF-A3-10: In-Transit Bed Hold Protection & Transport Cancellation Grace**
  - **Location:** [`src/components/ward-management/handover/ward-handover.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/handover/ward-handover.tsx), [`src/components/ward-management/ward-flow-reducer.ts:CANCEL_TRANSPORT`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward-flow-reducer.ts)
  - **Clinical Appraisal:** When ambulance transit takes >4 hours (e.g. Bunbury/Northam), the Handover board marks the hold "Expired", prompting re-pull while the patient is in transit. Additionally, ambulance cancellations silently refund beds instead of holding them for clinical review.
  - **Action:** Enforce Invariant `I-04`: when in transit (`enRouteAt`), freeze expiry and badge hold *"In Transit — Protected"*. On transport cancellation, transition to `transportStoppedAwaitingRelease` with a 2-hour hold grace period before manual release.

- [ ] **WF-S2-03 & WF-S2-07: Conservation of Physical Bed Capacity & Pre-Allocation Guard**
  - **Location:** [`src/components/ward-management/ward-flow-reducer.ts:PATIENT_ARRIVED,RELEASE_BED`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward-flow-reducer.ts)
  - **Clinical Appraisal:** Over-capacity emergency arrivals increment `occupiedBeds` above physical beds; discharging later decrements total occupied beds, creating phantom free rooms. Clicking "Release" on pre-allocation accepted patients emits spurious `RELEASE_BED` audit events.
  - **Action:** Enforce Invariant `I-02`: clamp bed capacity strictly to physical room definitions; track overflow in an `unplacedInpatients` tally. Guard `RELEASE_BED`: only emit event and alter capacity if `movement.allocatedBed !== undefined`.

- [ ] **WF-A3-01: Bed Shortfall Deduplication in Tomorrow's Beds Forecast**
  - **Location:** [`src/components/ward-management/capacity/beds-forecast.ts:145`](file:///d:/Repos/Ward-Flow/src/components/ward-management/capacity/beds-forecast.ts#L145)
  - **Clinical Appraisal:** Forecast counts patients with accepted referrals as "needing beds", but fails to subtract patients who already have a physical bed pulled, creating false double-deficits in executive morning sheets.
  - **Action:** Deduct `pulledMovements` from the incoming demand denominator before subtracting projected discharges.

- [ ] **WF-A3-14 / WF-FIX-10: Clamp Capacity Cards to Physical Rooms & Closed Wards**
  - **Location:** [`src/components/ward-management/ward/ward-derivations.ts:582`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward/ward-derivations.ts#L582)
  - **Clinical Appraisal:** On 0-bed or closed units, `available + held` can sum to positive numbers because math subtracts occupied from total without checking open status. Reporting available beds on closed units is a severe safety hazard.
  - **Action:** Clamp `available` to `Math.max(0, unit.beds - occupied - held)`. If `unit.isClosed` or `unit.beds === 0`, hard-pin `available: 0`.

- [ ] **WF-S1-08: Stale Hold Expiry Reset on Bed Re-Pull**
  - **Location:** [`src/components/ward-management/ward-flow-reducer.ts:PULL_PATIENT`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward-flow-reducer.ts)
  - **Clinical Appraisal:** If a bed pull is stepped back and re-pulled hours later, `pullExpiresAt` is not regenerated, causing the bed to instantly show as expired.
  - **Action:** On every `PULL_PATIENT` dispatch, unconditionally recalculate `pullExpiresAt = now + (holdDurationMinutes * 60000)`.

- [ ] **WF-S1-04 & WF-S2-04: Transport Officer Alert on Referral Withdrawal**
  - **Location:** [`src/components/ward-management/ward-flow-reducer.ts:WITHDRAW_REFERRAL`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward-flow-reducer.ts)
  - **Clinical Appraisal:** Withdrawing a referral with booked transport cancels the booking silently without alerting the Transport Officer or receiving ward.
  - **Action:** Dispatch a high-priority alert notice to the Transport Officer and receiving ward notice board upon withdrawal.

- [ ] **WF-S1-05: Automatic Target Ward Withdrawal on Revoked Examination**
  - **Location:** [`src/components/ward-management/ward-flow-reducer.ts:REVOKE_EXAMINATION`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward-flow-reducer.ts)
  - **Clinical Appraisal:** When a doctor revokes a Form 1A/3A, target receiving wards remain marked as active recipients in inbound queues, causing staff to continue discussing ineligible patients.
  - **Action:** Dispatch automatic withdrawal notices to all queried target wards upon `REVOKE_EXAMINATION`.

- [ ] **WF-S2-10 & WF-A1-10: Restrict Statewide Transport Declaration**
  - **Location:** [`src/components/ward-management/transport/ward-transport.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/transport/ward-transport.tsx)
  - **Clinical Appraisal:** Any user role can currently declare "No transport needed" or cancel transport for any patient statewide.
  - **Action:** Restrict transport modification to referring hospital, receiving ward, transport officer, or central coordinator (`actingPlaceId` check).

- [ ] **WF-A1-08 & WF-A1-09: Enforce Destination Facility Verification on Arrival & Signoff**
  - **Location:** [`src/components/ward-management/ward/ward-arrivals-corridor.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward/ward-arrivals-corridor.tsx)
  - **Clinical Appraisal:** Clinicians at Graylands can currently log arrivals or sign off ED medical clearances for patients admitted to Fiona Stanley Hospital.
  - **Action:** Enforce `wardActingUnitRefusal`: only staff logged into the destination facility may confirm physical arrival on the ward.

- [ ] **WF-A1-15: Coordinator Cockpit Action Role Attribution**
  - **Location:** [`src/components/ward-management/coordinator/coordinator-cockpit.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/coordinator/coordinator-cockpit.tsx)
  - **Clinical Appraisal:** Actions dispatched from the cockpit use role `ward`, making audit trails indicate the bedside nurse accepted the pull.
  - **Action:** Dispatch actions using `role: 'coordinator'`; update ward acceptance reducer to support coordinator-brokered bed pulls.

- [ ] **WF-AUD-06: Decouple ED Triage Buttons from Concurrent Ward Referral**
  - **Location:** [`src/components/ward-management/referrals/referral-match.tsx:1743`](file:///d:/Repos/Ward-Flow/src/components/ward-management/referrals/referral-match.tsx#L1743)
  - **Clinical Appraisal:** Concurrent referral to an inpatient ward and ED observation unit suppresses ED accept/decline buttons, stalling the ED care pathway.
  - **Action:** Render ED triage buttons whenever `edAddressing?.state === 'queued'`, regardless of inpatient ward status.

- [ ] **WF-AUD-08: Fallback Reducer Dispatch on 'Pull a bed'**
  - **Location:** [`src/components/ward-management/ward/ward-arrivals-corridor.tsx:295`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward/ward-arrivals-corridor.tsx#L295)
  - **Clinical Appraisal:** Clicking 'Pull a bed' when `onPullPatient` is not passed by a parent screen silently no-ops, frustrating ward staff.
  - **Action:** Add fallback: `if (!onPullPatient) dispatch({ type: 'PULL_PATIENT', ... })`.

---

### Track 3: Data Protection, Storage & Search Edge Cases
*These items protect synthetic data boundaries, local storage hygiene, and search precision.*

- [ ] **WF-A4-01 / WF-AUD-09: Expand Synthetic Data Guard Regex Patterns**
  - **Location:** [`src/lib/privacy.ts:76`](file:///d:/Repos/Ward-Flow/src/lib/privacy.ts#L76) & [`src/lib/synthetic-data-guard.ts:71`](file:///d:/Repos/Ward-Flow/src/lib/synthetic-data-guard.ts#L71)
  - **Action:** Expand regex alternation to `/\b(?:umrn|mrn|ur[n#]?|ihi)\s*[:#-]?\s*([0-9A-Za-z-]{6,})\b/gi` and ensure crawler converts numeric nodes to strings.

- [ ] **WF-A4-10: Redact Synthetic Identifiers on Diagnostic Copy**
  - **Location:** [`src/components/ward-management/settings/settings-screen.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/settings/settings-screen.tsx)
  - **Action:** Redact names, addresses, and identifiers with synthetic tokens before passing to `navigator.clipboard`.

- [ ] **WF-A1-06 & WF-A1-04: Preserve Patient Identity & MHA Continuation Codes in Audit Logs**
  - **Location:** [`src/components/ward-management/ward-event-log.ts`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward-event-log.ts)
  - **Action:** Include `patientId` on walk-in intakes and preserve MHA continuation codes (Form 5B, 3C) during log serialization.

- [ ] **WF-A2-04 to WF-A2-07: Local Storage Schema Validation & Auto-Save Timer Hygiene**
  - **Location:** [`src/components/ward-management/ward-local-storage.ts`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward-local-storage.ts), [`src/components/ward-management/ward-flow-provider.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward-flow-provider.tsx)
  - **Action:** Add lightweight schema validation on restore; drop corrupted keys to defaults. Show error toast on save failure. Clear auto-save timers immediately upon session clear.

- [ ] **WF-A4-06: Enforce Strict CSP Across All HTML Document Requests**
  - **Location:** [`src/lib/security-headers.ts`](file:///d:/Repos/Ward-Flow/src/lib/security-headers.ts)
  - **Action:** Eliminate image extension CSP bypasses on document requests.

- [ ] **WF-A3-03 & WF-A3-05: Correct Search Eligibility Filters for Allocated Inpatients**
  - **Location:** [`src/components/ward-management/search/patient-search.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/search/patient-search.tsx)
  - **Action:** Exclude patients with `stage >= 'pulled'` from "Nowhere eligible" filters, and ensure general search retains accepted patients.

- [ ] **WF-A3-08 & WF-A3-09: Withdrawn Referrals Archive & Truthful "Declined by all" Denominator**
  - **Location:** [`src/components/ward-management/referrals/referral-board.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/referrals/referral-board.tsx)
  - **Action:** Move withdrawn referrals to dedicated archive tab; calculate "Declined by all" only when `repliedCount === queriedCount && acceptedCount === 0`.

- [ ] **WF-M-DISCHARGE-NW: Wire Unwired Discharge Runway Action Buttons**
  - **Location:** [`src/components/ward-management/discharges/discharge-board.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/discharges/discharge-board.tsx)
  - **Action:** Connect action handlers or label as `(not wired)` with feedback toast per Decision D-16.

- [ ] **WF-FIX-05: Admitted Census Inpatients Direct Ward Jump Link**
  - **Location:** [`src/components/ward-management/search/patient-census-view.tsx:779`](file:///d:/Repos/Ward-Flow/src/components/ward-management/search/patient-census-view.tsx#L779)
  - **Action:** Render action button linking directly to `/mockups/ward-flow/ward/${row.unitId}?bed=${row.bedIndex}`.

---

### Track 4: Clinician Navigation, Responsive Layout & Accessibility
*These issues resolve UI regressions, focus trapping, and viewport layout integrity.*

- [ ] **WF-FIX-01: Remove 6 Unused Imports to Restore ESLint `--max-warnings 0` CI Gate**
  - **Location:** [`handover-phone.tsx:13`](file:///d:/Repos/Ward-Flow/src/components/ward-management/handover/handover-phone.tsx#L13), [`patient-census-view.tsx:17`](file:///d:/Repos/Ward-Flow/src/components/ward-management/search/patient-census-view.tsx#L17), [`statistics-summary-phone.tsx:9`](file:///d:/Repos/Ward-Flow/src/components/ward-management/statistics/statistics-summary-phone.tsx#L9)
  - **Action:** Prune unused symbols (`Count`, `rowTone`, `dueShort`, `History`, `Sheet`, `FactGrid`) to unblock CI.

- [ ] **WF-FIX-02: Fix 768px iPad Portrait Viewport Breakpoint Misclassification**
  - **Location:** [`src/components/wf/use-is-phone.ts:6-10`](file:///d:/Repos/Ward-Flow/src/components/wf/use-is-phone.ts#L6-L10)
  - **Action:** Set `WF_PHONE_QUERY = "(max-width: 47.9375rem)"` (767px) so 768px iPads render the tablet rail and full tables instead of mobile phone docks.

- [ ] **WF-FIX-06: Synchronize Bed Dossier Drawer with Browser Back Navigation**
  - **Location:** [`src/components/ward-management/ward/ward-screen.tsx:316`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward/ward-screen.tsx#L316)
  - **Action:** Sync `selectedBed` with URL searchParams (`?bed=XX`) so pressing browser Back closes the drawer without navigating away from the ward.

- [ ] **WF-FIX-07, WF-FIX-08 & WF-AUD-13: Prevent Double Modal Registration & Escape Key Leakage**
  - **Location:** [`src/components/ward-management/ward-tasks-drawer.tsx:189`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward-tasks-drawer.tsx#L189), [`src/components/ward-management/ward/ward-screen.tsx:509`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward/ward-screen.tsx#L509)
  - **Action:** Pass `withBackdrop` into `useWardModalFocus`. Check `event.defaultPrevented` and top-sheet status in background Escape listeners to stop simultaneous dismissal of foreground and background drawers.

- [ ] **WF-AUD-10: Remove Overriding `aria-label` on Patient Search Cards**
  - **Location:** [`src/components/ward-management/search/patient-search.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/search/patient-search.tsx)
  - **Action:** Remove container `aria-label` that wipes child text nodes from screen readers; structure accessible names using semantic elements.

- [ ] **WF-AUD-11: Fix Checkbox & Radio SVG Indicator Visibility**
  - **Action:** Target sibling box (`peer-checked:[&_svg]:opacity-100`) so checkmarks and radio bullets render reliably.

- [ ] **WF-AUD-12: Replace `display: none` Headings with Accessible `sr-only` Elements**
  - **Action:** Use `<h1 className="sr-only">` to preserve semantic heading outlines for screen readers.

- [ ] **WF-R07, WF-R09 & WF-R14: PWA Theme Color, Landmark Test Coverage & Prefetch Warning**
  - **Action:** Add `background_color: "#0f172a"` to `manifest.ts`; add sign-in route to landmark tests; strip prefetch props on plain test DOM anchors.

- [ ] **Secondary Workflow & CSS Hygiene Batch:**
  - `S2-6` (repatriation initiation states), `S1-3` (walk-in community patient linking), `S1-6` (spurious override logging), `S1-7` (auto-resolve peer inquiries to "Placed elsewhere"), `S2-5` (guard arrivals on closed journeys), `S2-9` (unified security gate evaluation), `S2-13` (discharge revision counter double-advance), `S2-14` (disable withdrawal button when invalid), `S2-15` (alert stand-down role attribution), `S1-12` (guard unassigned ward event calculations), `S1-14` (ED release timeout to 48 hours), `A1-7` (originType attribution for ward referrals), `A1-11` (initial authorisation audit tagging), `A1-12` (scope refusal classification), `A1-13` (restrict broadcast alert dismissal to NUM/coordinator), `A1-14` (restrict community note edits), `WF-FIX-09` (cover inter-hospital transfers in D-30 gate), `A2-8` (HTTP 409 Conflict on state race), `A2-10` (clear last-look delta on reset), `A2-15` (rolling 24h midnight window), `A3-4` (re-categorize transport delays), `A3-6` (separate waitlist from declined in stats), `A3-7` (ward response clock from queriedAt), `A3-11` (reset inactivity timer on bed pull), `A3-12` (route revoked exam to ED team), `A3-13` (non-binary settlement predicate), `A3-15` (harmonize midnight rule to dayOf), `A4-2` (convert numeric IDs to strings), `A4-7` (delete standalone HTML mockups in public/), `A4-13` (bind dev server strictly to 127.0.0.1), `M-TOKENS` (unify button CSS classes), `M-DEAD` (prune dead components), `M-WARD-ANSWER` (hide disabled waitlist button), `M-CONTACTS` (disclaimer banner on catchment contacts), `M-HOSTING` (update hosting docs).

---

### Track 5: Active Local Workspace Debt (Immediate Actionable)
*These tasks resolve local machine clutter without touching production code or altering verified application behaviour.*

- [ ] **WF-ACT-01: Detach Stale Codex Worktree & Fast-Forward Local `main`**
  - **Context:** The local `D:\Repos\Ward-Flow` checkout is parked on a dead branch (`feat/movement-drawer-audit-and-actions`), while local `main` is locked by a stale Codex worktree at `C:\Users\joshs\Documents\Codex\2026-10-05\task\ward-local-main`.
  - **Action:** Detach the worktree at `C:\Users\joshs\Documents\Codex\2026-10-05\task\ward-local-main`, switch `D:\Repos\Ward-Flow` to `main`, and fast-forward cleanly to `origin/main` commit `0ddcf956`.
- [ ] **WF-ACT-02: Itemized Pruning of 57 Stale Git Worktrees**
  - **Context:** Git tracks 57 worktrees across `D:\Repos\Ward-Flow\.worktrees\`, `D:\Temp\`, and `C:\Users\joshs\Documents\Codex\`. Under the Dev Drive Deletion Safeguard (Recorded 2026-09-26), worktrees under `D:\Worktrees` and `D:\Repos` cannot be removed without Josh's explicit approval.
  - **Action:** Present an itemized approval list to Josh containing the 12 merged worktrees in `.worktrees/` and 22 in `D:\Temp/` for safe deletion.
- [ ] **WF-ACT-03: Purge 77 Untracked Scratch Files from Working Copy**
  - **Context:** 20 standalone HTML mockups in `public/` (violating the React/Next.js mandate of 5 October 2026) and 45+ single-use crop scripts in `scripts/` clutter the local working tree.
  - **Action:** Remove obsolete standalone HTML files in `public/` and stray diagnostic scripts in root, updating `.gitignore`.

---

### Track 6: Pre-Pilot External Governance Hard Gates (Parked per D-36 & D-37)
*These are external regulatory, clinical, and institutional gates required before any live patient trial. They are formally parked during prototype mode; operational postures and compliance dossiers are ratified in Decision D-37.*

- [ ] **WF-GATE-01 (WF-46): Clinical Safety Officer (CSO) Sign-off & Hazard Log**
  - **Posture:** Lead Psychiatrist governance active; Clinical Safety Case baseline ratified (`CLINICAL-SAFETY-CASE.md`, HAZ-01–05 mitigated). Accredited external CSO appointment scheduled pre-pilot per D-36.
- [ ] **WF-GATE-02 (WF-53): Aboriginal Cultural Safety Review**
  - **Posture:** Aboriginal Cultural Safety Charter ratified (`ABORIGINAL-CULTURAL-SAFETY-CHARTER.md`) with 4 consultative partner bodies specified. Formal external consultative review scheduled pre-pilot per D-36.
- [ ] **WF-GATE-03 (WF-54): TGA / Medical Device (SaMD) Regulatory Filing**
  - **Posture:** TGA Clinical Decision Support Software exemption position ratified (Therapeutic Goods Regs Sch 4 Pt 2 exempt; no automated bed allocation). Regulatory registration filing scheduled pre-pilot per D-36.
- [ ] **WF-GATE-04 (WF-55): External Privacy Impact Assessment (PIA)**
  - **Posture:** Privacy Architecture Standard ratified (100% synthetic isolation, data minimisation on public boards, role-scoped details). External legal PIA scheduled during WA Health IT onboarding per D-36.
- [ ] **WF-GATE-05 (WF-56): Crown Law Statutory Review of Legal Forms**
  - **Posture:** Advisory Notice Only doctrine ratified; warning-only display adheres strictly to recorded clinician dates without synthetic clocks. Formal Crown Law legal review scheduled pre-pilot per D-36.
- [ ] **WF-GATE-06 (WF-57): Forensic Post-Incident Review (PIR) Telemetry Audit**
  - **Posture:** PIR Immutable Telemetry Specification ratified (Invariants I-01–I-14 append-only event ledger; single-click PIR export). Forensic legal audit standard scheduled pre-pilot per D-36.
- [ ] **WF-GATE-07 (WF-29): Hospital Entra ID (Azure AD) Single Sign-On & RBAC**
  - **Posture:** 4-tier service-scoped RBAC architecture ratified in D-37; D-14 default-deny privacy barrier active. Live Entra ID integration parked until hospital IT commissioning per D-36. Incorporates `AUD-03` (GUID claim case normalization) and `A4-8` (guest token enforcement).
- [ ] **WF-GATE-08 (WF-33): Cloud PostgreSQL Multi-Tenant Database Migration**
  - **Posture:** Backend persistence code-complete (24 tests passing); local JSON scenario save/load active (PR #50). Live cloud DB parked until hospital pilot funding per D-18/D-36/D-37. Incorporates `A4-3` (synthetic data guard request middleware).
- [ ] **WF-GATE-09 (WF-44): Clinic-by-Clinic Community Directory Phone Audit**
  - **Posture:** Public WA Health directory live for demonstration with coordinator override capability. Physical clinic phone verification audit parked until site onboarding per D-36.

---

### Track 7: Post-Pilot Phase 2 Roadmap & Architectural Evolution
*Future feature roadmaps formally deferred past the demonstration prototype, plus design proposals (D1–D9).*

- [ ] **WF-ROAD-01: Direct Community Clinic Referral Flow**
  - **Status:** Deferred to Phase 2 by Decision D-30. Current prototype routes emergency referrals via ED and central bed coordinator.
- [ ] **WF-ROAD-02: Regional Aeromedical Multi-Leg Patient Transit**
  - **Status:** Deferred to post-pilot regional expansion by Decision D-35. Models RFDS fixed-wing flights coordinated with secondary St John WA road ambulances.
- [ ] **WF-ROAD-03: Live WebPAS / PSOLIS Bidirectional EHR Integration**
  - **Status:** Deferred to hospital deployment. Current prototype runs on 100% synthetic data scenarios without EHR dependencies.
- [ ] **WF-ROAD-04: Hospital Ward Physical Wallboard Hardware Deployment**
  - **Status:** Architecture supports full-screen high-contrast wallboard view modes; physical display deployment scheduled with hospital facilities.
- [ ] **WF-DESIGN-PROPOSALS (D1–D9):**
  - `D1`: Bed dossier slide-in `@keyframes` entrance animations.
  - `D2`: Ban `transition: all` across CSS modules; scope transitions strictly to `opacity, transform`.
  - `D3`: Reserve explicit `min-height` floors on tables and matrix grids to eliminate tab-switch CLS.
  - `D4`: Implement lightweight offline Service Worker app shell cache without storing clinical text (D-18 compliant).
  - `D5`: PWA shortcuts and screenshots in `manifest.ts`.
  - `D6`: Automated `@axe-core/playwright` accessibility regression scans in CI.
  - `D7`: Accessible validation explanation lines on disabled actions.
  - `D8`: Progressively migrate raw HTML `<table>` elements to accessible `WardTable`.
  - `D9`: Clean up obsolete mockup drawings in `docs/ward-flow/mockups/`.
- [ ] **WF-ARCH-REDUCER: Progressive Domain Slicing of Main State Reducer**
  - **Status:** Safely split the ~9,700 line state reducer into scoped domain slices (`referralsReducer`, `movementsReducer`, `capacityReducer`) while preserving atomic transaction dispatch.

