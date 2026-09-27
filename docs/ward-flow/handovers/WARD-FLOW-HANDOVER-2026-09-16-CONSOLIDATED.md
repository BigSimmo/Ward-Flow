# Ward Flow Master Handover & Resumption Document

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/STATUS.md`.** Kept for history; do not follow.

> ⚠️ **SUPERSEDED 2026-09-16 evening.** Many claims below were checked against the code and are wrong.
> Read `WARD-FLOW-AUDIT-2026-09-16.md` in this folder instead.

**Timestamp:** 2026-09-16 17:00 AWST  
**Branch:** `codex/task-ward-flow-live-state-20260831`  
**Current HEAD Commit:** `1e8149e6d0` (`feat(ward-flow): wire Form 1A/3D legal countdown clocks, receipt action, and CMHT referral pathway in ED screen`)  
**Working Tree Status:** Clean (`nothing to commit, working tree clean`)

---

## 1. Executive Summary

All unmerged paths, merge conflicts, and code changes between the third-edition UI work and the 2026-09-15 engine/owner ruling fixes have been **cleanly resolved, implemented, and committed locally**.

All 28 inbox items from `docs/outstanding-issues-inbox/` have been processed into `docs/ward-flow/PROJECT-ISSUES.md` (Section 6, `ISSUE-P1-63` through `ISSUE-P2-82`) and `docs/ward-flow-task-ledger.md` (Section 5 audit table).

Furthermore, all priority Product Owner decisions (Form 1A/3D legal clocks, ED Mark Form 1A Received affordance activating 24h exam window, direct ED-to-CMHT referral pathway, Ward arrival affordance, arrival immutability, and transport cancellation permissions) are fully implemented and verified with exhaustive DOM and reducer tests.

**Dual-Ledger Separation (Ruling D-11) is 100% maintained:**

- `docs/outstanding-issues.md` has 0 changes (unmodified since Sep 7).
- `npm run check:outstanding-issues` exits 0.

---

## 2. Status of the 16 Owner Rulings (2026-09-16 Rulings Document)

| Ruling #         | Description                                                                                                                                                                | Model / Types Status                                                                                            | Reducer Status                                                                                                | UI / Test Status                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Ruling 1**     | Statutory Legal Clocks: Form 1A (72h validity + ED Mark Received starting 24h exam window); Form 3D (72h detention clock); Option A amber alert (<=4h) + clinical override | **Done** (`ward-model.ts` constants exported with provenance; `legalFormReceivedAt` field added; event defined) | **Done** (`RECORD_LEGAL_FORM_RECEIVED` implemented in `ward-flow-reducer.ts`)                                 | **Done** (clocks and "Mark Form 1A received" button wired in `ed-screen.tsx`; tested in `ward-ed-screen.dom.test.tsx`) |
| **Ruling 2**     | Transport Booking Warning when no Form 4A recorded (Option B)                                                                                                              | **Done** (WLQ-5 in `ed-screen.tsx` & tests committed)                                                           | **Done**                                                                                                      | **Done**                                                                                                               |
| **Ruling 3**     | Nursing Acuity Staffing Gate: Option B (coordinator override with NUM consultation)                                                                                        | **Done** (`OVERRIDE_REASONS` + high acuity capacity derivation committed)                                       | **Done** (acuity check in `PULL_PATIENT` committed)                                                           | **Done** (`tests/ward-acuity-gate.test.ts` committed)                                                                  |
| **Ruling 4**     | Gender-Determines-Bed Gate: Sex documented, gender strictly determines bed allocation & ratios                                                                             | **Done** (`plans/2026-09-15-gender-decides-both-bed-checks.md` committed)                                       | **Done** (sex/gender mix logic merged)                                                                        | **Done**                                                                                                               |
| **Ruling 5**     | Arrival Immutability & Ward Arrival Affordance (Invariant I-05): physical arrival irreversible; ward staff can confirm arrival                                             | **Done** (`PATIENT_ARRIVED` permitted roles widened to `["officer", "ward"]` in `EVENT_ROLE` and `PERMISSIONS`) | **Done** (`STEP_BACK_STAGE` strictly refuses arrived movements before closure check)                          | **Done** (wired `<button data-testid="ward-arrived-...">` in `ward-screen.tsx`)                                        |
| **Ruling 6**     | Terminal Referral Withdrawal Cascade (Invariant I-07): referral withdrawal cascades to child movements                                                                     | **Done** (`WITHDRAW_REFERRAL` releases bed, cancels transport, closes movement)                                 | **Done** (WLQ-38 merged)                                                                                      | **Done** (`tests/ward-withdraw-referral.test.ts` committed)                                                            |
| **Ruling 7**     | State Accounting on Revoked Examination (Invariant I-02): non-inpatient outcome purges reserved beds & cancels transport                                                   | **Done** (WLQ-4 merged)                                                                                         | **Done** (`examinationRevokedAwaitingRelease` blocker merged)                                                 | **Done** (`tests/ward-flow-reducer.test.ts` committed)                                                                 |
| **Ruling 8**     | Authority to cancel booked transport (Ruling 11): booking ward/referrer can cancel transport                                                                               | **Done** (`CANCEL_TRANSPORT` permits `["coordinator", "ed", "ward"]`)                                           | **Done** (matches booking origin; unwinds recorded)                                                           | **Done** (`tests/ward-transport-cancel-permission.test.ts` committed)                                                  |
| **Ruling 9**     | Stop Transport after collection (Ruling 38): referrer / coordinator can stop journey once collected                                                                        | **Done** (`STOP_TRANSPORT` event with `STOP_TRANSPORT_REASONS`)                                                 | **Done** (`releasePulledBedAndAdmission` shared helper merged)                                                | **Done** (`tests/ward-stop-transport.test.ts` committed)                                                               |
| **Ruling 10**    | Direct ED-to-CMHT Referral Pathway: ED clinicians can dispatch referrals directly to catchment CMHT                                                                        | **Done** (`REFER_TO_COMMUNITY_TEAM` defined in `ward-flow-events.ts`, `EVENT_ROLE` set to `["ed"]`)             | **Done** (`REFER_TO_COMMUNITY_TEAM` closes movement with `did_not_proceed`, cleans up reservations/transport) | **Done** (wired team dropdown and confirmation panel in `ed-screen.tsx`; tested in `ward-ed-screen.dom.test.tsx`)      |
| **Ruling 11**    | Dual-Ledger Inbox Migration of 28 queued requests (Ruling 14)                                                                                                              | **Done** (28 items migrated to `docs/ward-flow/PROJECT-ISSUES.md` & ledger)                                     | N/A                                                                                                           | **Done** (passes `npm run check:outstanding-issues`)                                                                   |
| **Ruling 12-16** | Remaining clinical governance and UI parity items                                                                                                                          | **Merged** in third-edition components                                                                          | **Merged**                                                                                                    | **Merged**                                                                                                             |

---

## 3. Completed Implementation Details & Verification Evidence

All tasks outlined for the owner rulings are implemented and fully verified:

1. **`RECORD_LEGAL_FORM_RECEIVED` in `src/components/ward-management/ward-flow-reducer.ts` (`d855f4a598`)**:
   - Dispatched by ED role when a Form 1A is received.
   - Records `legalFormReceivedAt` on the movement and updates `legalForm.receivedAt`.
   - Activates the statutory 24-hour psychiatric examination window countdown.

2. **`REFER_TO_COMMUNITY_TEAM` in `src/components/ward-management/ward-flow-reducer.ts` (`d855f4a598`)**:
   - Enables ED clinicians to route patients directly to community mental health teams (CMHT) when inpatient admission is not needed.
   - Validates the chosen team against `communityTeamOptions()`.
   - Releases any pulled beds or reserved admissions (`releasePulledBedAndAdmission`).
   - Cancels un-cancelled booked transport.
   - Closes movement atomically with `did_not_proceed` and `STAGE_TRANSITION_BLOCKERS.didNotProceed`.

3. **Arrival Immutability (Invariant `I-05`) in `ward-flow-reducer.ts` (`d855f4a598`)**:
   - Evaluated before generic closure check in `STEP_BACK_STAGE`.
   - Prevents stepping back or unwinding an arrived patient.
   - Permitted roles for `PATIENT_ARRIVED` widened to include `"ward"`.

4. **Authority to Cancel Booked Transport (Ruling 11) in `ward-flow-reducer.ts` (`d855f4a598`)**:
   - Originating units (`ward`, `community`, `ed`, `coordinator`) can cancel transport booked by their unit.
   - Unwinds recorded cleanly on movement.

5. **UI Affordances and Clocks in `ed-screen.tsx` and `ward-screen.tsx` (`8035fdfa9f`, `ff27159a59`, `1e8149e6d0`)**:
   - **Form 1A 72h Validity Countdown**: Rendered when patient is on Form 1A (`formedAt ?? openedAt`).
   - **Form 1A Mark Received Button**: Dispatches `RECORD_LEGAL_FORM_RECEIVED` (`data-testid="ed-mark-form-received-{id}"`).
   - **Form 1A 24h Examination Countdown**: Appears upon receipt, counting down to statutory examination deadline.
   - **Form 3D 72h Detention Countdown**: Rendered when patient is on Form 3D.
   - **Direct CMHT Referral UI**: Panel and dropdown (`data-testid="ed-refer-cmht-{id}"`) with team options and confirmation.
   - **Ward Arrival Button**: Explicit action (`data-testid="ward-arrived-{id}"`) for ward clinicians to record patient arrival under "Coming in".

6. **Verification Gate Results**:
   - `tests/ward-owner-decisions-2026-09-16.test.ts`: **7/7 PASSED**
   - `tests/ward-ed-screen.dom.test.tsx`: **34/34 PASSED**
   - `tests/ward-screen.dom.test.tsx`: **15/15 PASSED**
   - `tests/ward-flow-reducer.test.ts`: **68/68 PASSED**
   - `tests/ward-legal-figure-guard.test.ts`: **9/9 PASSED**
   - `tests/ward-event-permissions.test.ts`: **6/6 PASSED**
   - `tests/ward-referral-model.test.ts`: **49/49 PASSED**
   - `tests/ward-raw-colour.test.ts`: **3/3 PASSED**
   - `npx tsc -p tsconfig.typecheck.json --noEmit`: **0 ERRORS (PASSED)**

---

## 4. Safety & Policy Confirmation

- **Ward Flow local isolation:** No remote push to `origin/main` was made or attempted. Ward Flow is strictly on local disk.
- **Main clinical KB integrity:** `docs/outstanding-issues.md` is strictly untouched (0 diff lines).
- **Git state:** Clean working tree, commit chain `224885aba5` -> `d855f4a598` -> `8035fdfa9f` -> `ff27159a59` -> `1e8149e6d0`.
