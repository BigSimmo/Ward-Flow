# Ward Flow — Master Handover & State of Caseload System

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/STATUS.md`.** Kept for history; do not follow.

**Written: 2026-09-14T21:34:00+08:00**  
**Branch:** `codex/task-ward-flow-live-state-20260831`  
**Base:** Strictly Local Worktree (`d:\Worktrees\Database\ward-lead`)  
**Authority & Governance:** Conforms to Owner Ruling **D-11** (two-ledger separation) and `AGENTS.md` (Ward Flow is never pushed to `origin/main`).

---

## 1. Executive Summary & Current State

### What Was Just Built & Verified (Session Deliverable)

1. **Master Project Issues Catalog**:
   - Authored [`docs/ward-flow/PROJECT-ISSUES.md`](../PROJECT-ISSUES.md): the authoritative cross-session register of all **62 verified issues** and **13 active blocking questions**, fully reconciled with the OneDrive Master Audit (`Ward_Flow_Master_2026-09-13.md`) and Master Tracker (`Ward_Flow_Master_Tracker.xlsx`).
   - Reconciled [`docs/ward-flow-task-ledger.md`](../../ward-flow-task-ledger.md) with the 14 Whole-Journey Invariants (`I-01` to `I-14`), 52 Canonical Families (`WF-01` to `WF-52`), and 483-alias Crosswalk.
2. **Third-Edition Patient Search (`src/components/ward-management/search/`)**:
   - Implemented [`patient-search.tsx`](../../../src/components/ward-management/search/patient-search.tsx) and [`search-filters.ts`](../../../src/components/ward-management/search/search-filters.ts) matching the Sovereign Clinical Console design standard (`docs/ward-flow/mockups/patient-search-perfected-third-edition.html`).
   - **4 Dropdown Filters**: **Service** (East Metro, North Metro, South Metro, WACHS), **Setting** (ED, Inpatient Ward, In-Transit), **Legal Status** (Form 1A, Form 4A, Form 5A, Voluntary), and **Wait Band** (< 6h, 6–24h, > 24h).
   - **Dynamic Facet Counts**: Every option displays `(N)` calculating the exact number of matching records if that filter is applied while holding others fixed.
   - **Quick Query Chips**: Fast 1-click clinical chips (`Form 1A`, `Form 4A`, `Form 5A`, `Peel ED`, `Adult Secure`, `Waiting > 24h`, `Unplaced`).
   - **Filter Reset**: "Reset filters" action button restores all default queries.
   - **Yield Summary Strip**: 5 high-density metric cards (_Patients Matching_, _Unplaced Referrals_, _Bed Holds / Pulled_, _Active In-Transit_, _Breaching Wait >24h_).
   - **Styling**: [`search.module.css`](../../../src/components/ward-management/search/search.module.css) is 100% tokenized using Sovereign Clinical Console custom properties (`var(--surface)`, `var(--sunk)`, `var(--accent)`, `var(--gilt)`, `var(--lift)`, `var(--line-strong)`); zero raw hex/rgb/hsl literals.
3. **Verification**:
   - `npx vitest run tests/ward-patient-search.dom.test.tsx`: **46/46 PASSED** (all 38 original assertions + 8 new tests).
   - `npx vitest run tests/ward-patient-search.test.ts`: **22/22 PASSED**.
   - `npx tsc -p tsconfig.typecheck.json --noEmit`: **0 ERRORS**.
   - `npx vitest run tests/ward-chrome-owner.test.ts`: **10/10 PASSED** (single search composer invariant preserved).
   - `npm run check:outstanding-issues`: **PASSED**.

---

## 2. Master Catalog of Issues (62 Verified Issues)

The complete catalog with file line numbers, defect mechanisms, clinical risks, and closure criteria lives in **[`docs/ward-flow/PROJECT-ISSUES.md`](../PROJECT-ISSUES.md)**.

### Summary Tally

| Severity Tier            | Issue Count | Subsystem Focus                                                                                                      |
| ------------------------ | :---------: | -------------------------------------------------------------------------------------------------------------------- |
| **Tier 1: P0 Critical**  |   **13**    | Statutory breaches (WA MHA 2014), state-machine deadlocks, irreversible arrival erasure, D-14 privacy violations.    |
| **Tier 2: P1 Serious**   |   **21**    | Bed capacity arithmetic leaks, decoupled intake architecture, missing undo/cancellation handlers, temporal collapse. |
| **Tier 3: P2 Important** |   **28**    | Priority queue distortions, permissions matrix omissions, legibility, model drift.                                   |
| **Total Issues**         |   **62**    | **Mapped to Invariants `I-01` to `I-14` and Canonical Families `WF-01` to `WF-52`**                                  |

### Tier 1 (P0 Critical) Quick Reference

1. **`ISSUE-P0-01`**: Form 1A 24-Hour Statutory Expiry Countdown Clock Missing (`ed-screen.tsx`, `ward-legal-forms.ts`).
2. **`ISSUE-P0-02`**: Cross-Ward Default-Deny Privacy Boundary Violation under Owner Ruling D-14 (`ward-derivations.ts`, `record-preview.tsx`).
3. **`ISSUE-P0-03`**: Irreversible Physical Arrival Erasure via Administrative Step-Back (`ward-flow-reducer.ts:1924`, Invariant `I-05`).
4. **`ISSUE-P0-04`**: Acuity-Staffing Ratio Bypass at Physical Bed Allocation (`ward-admissions.ts:686-703`, `I-06` / `WF-03`).
5. **`ISSUE-P0-05`**: Front-Door Terminal Withdrawal Orphan Cascade (`ward-flow-reducer.ts:3120-3165`, `I-07` / `WF-10`).
6. **`ISSUE-P0-06`**: Transport Cancellation Auto-Advances Movement to Handover Ready (`ward-flow-reducer.ts:2410-2435`, `I-04` / `WF-04`).
7. **`ISSUE-P0-07`**: Form 4A Transport Order Statutory Validity Unchecked Before Booking (`ward-model.ts:588-601`).
8. **`ISSUE-P0-08`**: State Accounting Inconsistency on Revoked Examination Closure (`ward-flow-reducer.ts:1605-1632`, `I-02` / `WF-01`).
9. **`ISSUE-P0-09`**: Permissions Matrix Omits 3 Reducer Events (56 Defined vs 53 Mapped) (`ward-permissions.ts`).
10. **`ISSUE-P0-10`**: Command Timeline Dynamically Rewrites Historical Events (`command-activity.tsx`, `I-14`).
11. **`ISSUE-P0-11`**: Gender-Determines-Bed Safety Gate Missing from Movements and Referrals (`ward-eligibility.ts:180-210`).
12. **`ISSUE-P0-12`**: Zero Timestamp Milestone Coercion to Undefined (`ward-clock.ts`, `I-12`).
13. **`ISSUE-P0-13`**: Rolling 24-Hour Horizon vs Calendar-Day Temporal Collapse (`delays-screen.tsx`, `forecast.ts`, `I-13`).

---

## 3. Active Blocking Questions (13 Decisions)

Detailed clinical impacts, options, and recommendations are in **[`docs/ward-flow/archive/dated-notes/PROJECT-ISSUES.md#2-for-the-owner`](../archive/dated-notes/PROJECT-ISSUES.md#2-for-the-owner)**.

### ① Clinical & Statutory Decisions

- **`Q-01`**: Statutory Hard-Stop Enforcement for Form 1A 24-Hour Expiry (Alert only vs. Hard placement block). _Recommendation: Alert at 20h, prominent red banner at 24h, allow placement with explicit practitioner override._
- **`Q-02`**: Form 4A Statutory Transport Order Requirement (Strict validation vs. Advisory). _Recommendation: Strict validation blocking booking unless Form 4A timestamp is present._
- **`Q-03`**: High-Acuity Nursing Ratio Gate Override Authority. _Recommendation: Block allocation when ratio is 0, allow coordinator override requiring clinical reason._
- **`Q-04`**: Gender Compatibility Enforcement on Inpatient Bed Boards. _Recommendation: Hard block allocating male patient to female-only room/unit._

### ② Architecture & State-Machine Decisions

- **`Q-05`**: Invariant `I-05` Immutability of Physical Arrival Events. _Recommendation: `PATIENT_ARRIVED` is irreversible; administrative errors handled via compensatory transfer/discharge._
- **`Q-06`**: Invariant `I-07` Atomic Referral Withdrawal Cascade. _Recommendation: Withdrawing a referral atomically cancels all open destination addressings._
- **`Q-07`**: Handling Dispatched Transport Cancellation (`I-04`). _Recommendation: Transport cancellation returns movement to `awaiting_transport`, not `handover_ready`._
- **`Q-08`**: Non-Inpatient Examination Closure Accounting (`I-02`). _Recommendation: Atomically release reservations and delete orphaned admissions on revoked examination._

### ③ UX, Privacy & Governance Decisions

- **`Q-09`**: Scope of Cross-Ward Movement History under Owner Ruling D-14. _Recommendation: Ward users see only admissions/movements involving their own unit; Flow Coordinators see full network history._
- **`Q-10`**: Authority to Cancel Booked Transport. _Recommendation: Bed coordinators and originating ED can cancel transport; receiving ward cannot cancel vehicles unilaterally._
- **`Q-11`**: Command Activity Timeline Immutability (`I-14`). _Recommendation: Snapshot event state at time of occurrence; never re-evaluate dynamically._
- **`Q-12`**: Standard Definition of 24-Hour Delay Horizon (`I-13`). _Recommendation: Rolling 24-hour window from `now` (`[now, now + 1440m]`)._
- **`Q-13`**: RBAC Coverage for Missing Reducer Events (`ISSUE-P0-09`). _Recommendation: Map `SET_CLINICAL_FLAG`, `UPDATE_LEGAL_FORM_EXPIRY`, `OVERRIDE_TRANSPORT_ESCORT` to `bed_coordinator` role._

---

## 4. Key Files to Know

| File                      | Path                                                                                                                            | Purpose                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Master Issues Catalog** | [`docs/ward-flow/PROJECT-ISSUES.md`](../PROJECT-ISSUES.md)                                                                      | Authoritative register of 62 issues + 13 questions            |
| **Ward Flow Entry Point** | [`docs/ward-flow/README.md`](../README.md)                                                                                      | Entry point, commands, and rules                              |
| **New Chat Prompt**       | [`docs/ward-flow/NEW-CHAT-PROMPT.md`](../NEW-CHAT-PROMPT.md)                                                                    | Resumption instructions for AI sessions                       |
| **Task Ledger**           | [`docs/ward-flow-task-ledger.md`](../../ward-flow-task-ledger.md)                                                               | Reconciled task ledger (`WF-01` to `WF-52`, `I-01` to `I-14`) |
| **Perfected Mockup**      | [`docs/ward-flow/mockups/patient-search-perfected-third-edition.html`](../mockups/patient-search-perfected-third-edition.html)  | Authoritative UI reference for Patient Search                 |
| **Search Component**      | [`src/components/ward-management/search/patient-search.tsx`](../../../src/components/ward-management/search/patient-search.tsx) | Live React component with 4 dropdown filters & yield strip    |
| **Search Filters**        | [`src/components/ward-management/search/search-filters.ts`](../../../src/components/ward-management/search/search-filters.ts)   | Filter predicates, site mappings, and quick query chips       |
| **Search CSS**            | [`src/components/ward-management/search/search.module.css`](../../../src/components/ward-management/search/search.module.css)   | Sovereign Clinical Console token styles (0 raw colours)       |
| **Search DOM Tests**      | [`tests/ward-patient-search.dom.test.tsx`](../../../tests/ward-patient-search.dom.test.tsx)                                     | 46 comprehensive DOM tests                                    |

---

## 5. Immediate Next Steps for Next Session

1. **Address Top P0 Statutory Hazard (`ISSUE-P0-01`)**:
   - Implement Form 1A 24-hour statutory countdown timer `formedAt + 24h` on psychiatric patients in ED (`ed-screen.tsx`, `ward-legal-forms.ts`).
   - Decouple from hospital operational ED wait target (1440m).
   - Display prominent breach alert when `now >= formedAt + 24h`.
2. **Enforce D-14 Default-Deny Privacy Boundary (`ISSUE-P0-02`)**:
   - Filter cross-ward patient movement histories in `ward-derivations.ts` and `record-preview.tsx`.
   - Prevent ward-level users from discovering destinations where a patient was declined by other units.
3. **Lock Invariant `I-05` Against Physical Arrival Rollback (`ISSUE-P0-03`)**:
   - Prevent `STEP_BACK_STAGE` in `ward-flow-reducer.ts` from rolling back movements once `stage === "arrived"`.
   - Protect live bed ledger arithmetic from phantom occupancy.
