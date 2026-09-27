# Ward Flow Resumption Checkpoint — 2026-09-16 (15:56 AWST)

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/STATUS.md`.** Kept for history; do not follow.

> **Updated 2026-09-16, evening:** read
> [`WARD-FLOW-AUDIT-2026-09-16.md`](WARD-FLOW-AUDIT-2026-09-16.md) and
> [`WARD-LEAD-START-HERE-2026-09-16.md`](WARD-LEAD-START-HERE-2026-09-16.md) first. This
> checkpoint's "resolved with zero loss" claim about the 15:55 merge is contradicted by
> `WARD-LEAD-START-HERE-2026-09-16.md` §3, which records confirmed losses (WLQ-10's wording, the
> ledger's WLQ list). Re-check any status claim here against those two files before relying on it.

> 🔴 **CRITICAL WARD FLOW PROTOCOL REMINDERS:**
>
> 1. **Ward Flow is NEVER pushed to `origin/main`**. Both branches exist strictly on local disk (`d:\Worktrees\Database\ward-lead`).
> 2. **Design source of truth**: Drawings in `docs/ward-flow/mockups/` lead visuals; working engine in `src/components/ward-management/` leads state & behaviour.
> 3. **Working Tree Status**: `git status` is **CLEAN**. Merge commit `224885aba5766be866e2e9b19233ef26b9db37b3` is recorded.

---

## 1. What Has Been Completed & Verified Green

### A. Full Merge Conflict Resolution (Commit `224885aba5766be866e2e9b19233ef26b9db37b3`)

- **45 conflicting files** between `HEAD` (full estate third-edition visual rebuild) and `f4f22eb66f` (`WLQ-38` - referrer revocation / stop transport / clinical engine hardening) have been resolved with zero loss of visual styling or clinical state machines.
- Key resolutions:
  - `src/components/ward-management/ward-flow-reducer.ts`: Zero duplicate declarations; clean `STOP_TRANSPORT`, `RELEASE_PULL`, and post-acceptance `WITHDRAW_REFERRAL` flows.
  - `src/components/ward-management/ward-flow-events.ts`: Event union unified with `RECORD_LEGAL_FORM_RECEIVED`, `REFER_TO_COMMUNITY_TEAM`, and `STOP_TRANSPORT`.
  - `src/components/ward-management/out-of-area/out-of-area-board.tsx`: Visual third-edition components preserved alongside all test-contracted governance test IDs (`ward-out-of-area-counts`, `ward-out-of-area-governance`, `ward-out-of-area-subject-*`).
  - `src/components/ward-management/on-call/on-call-screen.tsx`: Third-edition clinical directory layout and modal preserved.
  - `src/components/ward-management/shell/ward-rail.tsx`: Active route matching and patient href preserved.
  - `src/components/ward-management/officer/officer-screen.tsx`: Third-edition header & KPI strip preserved.

### B. Gates & Verifications Fully Green

- **`node scripts/ward-flow/mockup-manifest.mjs --check`**: PASSED (42 drawings, byte-normalized sha256-lf).
- **`node scripts/ward-flow/screen-map.mjs --check`**: PASSED (42 mockups, 43 routes, no hard problems).
- **`npx vitest run tests/ward-legal-figure-guard.test.ts`**: PASSED (9/9 passed in 26s).
  - Explicit per-code sweeps for `RECORD_LEGAL_FORM_RECEIVED`, `REFER_TO_COMMUNITY_TEAM`, `WITHDRAW_ACCEPTANCE`, `RELEASE_PULL`, `STEP_BACK_STAGE`, `STOP_TRANSPORT`, `PATIENT_ARRIVED`.
- **`npx vitest run tests/ward-event-permissions.test.ts`**: PASSED (4/4 passed).
  - Pinned permissions for `RECORD_LEGAL_FORM_RECEIVED: ["ed"]`, `REFER_TO_COMMUNITY_TEAM: ["ed"]`, `PATIENT_ARRIVED: ["officer", "ward"]`.
- **`npx vitest run tests/ward-out-of-area`**: PASSED (16/16 passed).

---

## 2. Immediate Next Steps for Resuming Agent

Follow the approved **Recommended Remediation Sequence**:

### Step 1: Legal Wording & Chip Ergonomics (Phase 3)

1. **Search Screens Legal Wording**:
   - Inspect `src/components/ward-management/search/search-filters.ts` and `patient-search.tsx`.
   - Remove `(ED 24h)` from Form 1A; change Form 5A to CTO and decouple from involuntary bed filters.
2. **Gantt Chart Wording**:
   - In `src/components/ward-management/movements/movement-horizon-gantt.tsx` (around line 123), change "Form 5A trial leaves" to "Form 4B leave of absence" (under MHA 2014, Form 4B is Leave of Absence; Form 5A is CTO).
3. **Chip Ergonomics**:
   - In `src/components/ward-management/search/search.module.css`, ensure `.quickChip` has `min-height: 48px` to satisfy touch target ergonomic standards.

### Step 2: Implement 2026-09-16 Owner Rulings (Phase 4)

1. **Ruling 1 (Form 1A Receipt & Statutory Clocks in ED)**:
   - In `src/components/ward-management/ed/ed-screen.tsx`:
     - Wire a "Mark Form 1A as Received" button dispatching `RECORD_LEGAL_FORM_RECEIVED`.
     - Render the 72h validity clock (from `formedAt` until received).
     - Once received (`movement.legalFormReceivedAt`), render the 24h psychiatric examination window countdown.
2. **Ruling 6 (Human Physical Arrival Confirmation)**:
   - In `src/components/ward-management/ward/ward-screen.tsx` / `ward-board.tsx`:
     - For transfers in `"moving"` stage under "Coming in", add a `<button data-testid={`ward-arrived-${movement.id}`}>Mark patient arrived</button>` dispatching `PATIENT_ARRIVED` with `role: "ward"`.
3. **Ruling 16 (Direct ED-to-CMHT Referral Pathway)**:
   - In `src/components/ward-management/ed/ed-screen.tsx`:
     - Add button/modal to refer directly to a Community Mental Health Team via `REFER_TO_COMMUNITY_TEAM` (`team` selected from `communityTeamOptions()`).
4. **Ruling 4 (High-Acuity Nursing Ratio Gate in `PULL_PATIENT`)**:
   - In `src/components/ward-management/ward-flow-reducer.ts`:
     - Under `case "PULL_PATIENT"`: if `movement.highAcuity` is true, check `remainingHighAcuityCapacity(unit, state.admissions)` and reject if $\le 0$.

### Step 3: Verification

- Run:
  ```bash
  npx vitest run tests/ward-legal-figure-guard.test.ts
  npx vitest run tests/ward-event-permissions.test.ts
  npx vitest run tests/ward-ed-screen.dom.test.tsx
  npx vitest run tests/ward-patient-search.dom.test.tsx
  npx tsc -p tsconfig.typecheck.json --noEmit
  ```
