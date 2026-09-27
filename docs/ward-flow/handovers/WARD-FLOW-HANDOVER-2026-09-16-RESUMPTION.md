# Ward Flow Handover & Resumption Plan — 2026-09-16

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/STATUS.md`.** Kept for history; do not follow.

> **Updated 2026-09-16, evening:** read
> [`WARD-FLOW-AUDIT-2026-09-16.md`](WARD-FLOW-AUDIT-2026-09-16.md) and
> [`WARD-LEAD-START-HERE-2026-09-16.md`](WARD-LEAD-START-HERE-2026-09-16.md) first. Nine reviewers
> checked the ward line against the code after this document was written and found several claims
> below wrong; this document has not itself been marked superseded, so re-check any status claim
> here against those two files before relying on it.

> 🔴 **CRITICAL WARD FLOW PROTOCOL REMINDERS:**
>
> 1. **Ward Flow is never pushed to `origin/main`**. It exists on local disk only (`d:\Worktrees\Database\ward-lead`). Merging or pushing to `origin/main` triggers auto-deploys and live database schema migrations on the clinical database.
> 2. **Dual-ledger separation (Ruling D-11)**: Ward Flow issues belong strictly to `docs/ward-flow/PROJECT-ISSUES.md` and `docs/ward-flow-task-ledger.md`. NEVER touch `docs/outstanding-issues.md`.
> 3. **Design source of truth**: The drawings in `docs/ward-flow/mockups/` are authoritative on design tokens (`var(--...)`), and the working engine in `src/components/ward-management/` is authoritative on behaviour.

---

## 1. Executive Status at Session Save (2026-09-16)

- **Total Owner Rulings Ruled Upon**: 16 decisions received, clinically grounded under the Mental Health Act 2014 (WA), and formally codified in [`docs/ward-flow/owner-decisions-2026-09-16-rulings.md`](file:///d:/Worktrees/Database/ward-lead/docs/ward-flow/owner-decisions-2026-09-16-rulings.md).
- **Ruling 14 (Dual-Ledger Inbox Migration) COMPLETE**:
  - All 28 queued Ward Flow inbox JSON files in `docs/outstanding-issues-inbox/` have been processed, cross-referenced, and archived into `docs/outstanding-issues-inbox/applied/`.
  - Added Section 6 to [`docs/ward-flow/PROJECT-ISSUES.md`](file:///d:/Worktrees/Database/ward-lead/docs/ward-flow/PROJECT-ISSUES.md) creating issues `ISSUE-P1-63` through `ISSUE-P2-82` (catalogue expanded to 82 issues).
  - Added Section 5 to [`docs/ward-flow-task-ledger.md`](file:///d:/Worktrees/Database/ward-lead/docs/ward-flow-task-ledger.md) recording the migration audit table.
  - `docs/outstanding-issues.md` was strictly untouched.
  - Verified with `npm run check:outstanding-issues` and `tests/ward-ledger-stale-row-guard.test.ts` (all green).

---

## 2. Completed Architectural Specifications & Provenance

### A. Statutory Legal Clocks (Ruling 1)

- **Clinical & Legal Basis**:
  - WA Mental Health Act 2014 s34 & s36: Form 1A is a Referral for Examination. When made (`formedAt`), it has a **72-hour validity clock** for the patient to be received at an authorised hospital or ED.
  - Once physically received in ED (`legalFormReceivedAt`), s36 mandates a psychiatric examination within **24 hours**.
  - WA Mental Health Act 2014 s56: Form 3D is an Order for Detention for Assessment. It starts a **72-hour detention clock** from when placed.
- **Option A Alert Logic**:
  - Advisory amber warning when nearing expiry ($\le 4$ hours remaining).
  - Red breach alert if expired, but permits bed placement with recorded clinical justification.
- **Model Fields (`ward-model.ts`)**:
  - `Movement.legalFormReceivedAt?: Instant;`
  - `LegalForm.receivedAt?: Instant;`
  - Constants with verified provenance in `tests/ward-legal-figure-guard.test.ts`:
    - `FORM_1A_VALIDITY_MINUTES = 72 * 60;` (4320)
    - `FORM_1A_EXAMINATION_WINDOW_MINUTES = 24 * 60;` (1440)
    - `FORM_3D_DETENTION_WINDOW_MINUTES = 72 * 60;` (4320)

### B. Direct ED-to-CMHT Referral Pathway (Ruling 16) — Built ASAP

- **Clinical Need**: Common clinical pathway where ED psychiatric review concludes the patient does not need acute inpatient admission, but requires Community Mental Health Team (CMHT) follow-up.
- **Event**: `REFER_TO_COMMUNITY_TEAM` (`role: "ed"`).
  - Payload: `{ type: "REFER_TO_COMMUNITY_TEAM", role: "ed", now: Instant, movementId: string, teamName: string, notes?: string }`
  - Validates `teamName` using `communityTeamOptions()` from `referral-destination-options.ts`.
  - Creates child `Referral` addressed to `community_team` destination and transitions/closes `Movement` with `outcome: "discharged_to_community"`.
- **Screen Affordance**: Action button and modal in `ed-screen.tsx` action row / examination outcome.

### C. Arrival Immutability & Ward Arrival Affordance (Ruling 6 / Invariant I-05)

- **Rule**: Physical arrival at destination unit is irreversible.
- **Invariant `I-05`**: In `STEP_BACK_STAGE` (`ward-flow-reducer.ts`), strictly reject if `movement.stage === "arrived"` or `movement.transport?.arrivedAt !== undefined`.
- **Role Widening**: `EVENT_ROLE.PATIENT_ARRIVED` widened to `["officer", "ward"]`.
- **Ward UI**: In `ward/ward-screen.tsx`, under `<section aria-label="Coming in">`, render `<button data-testid={`ward-arrived-${movement.id}`}>Mark patient arrived</button>` for transfers in stage `"moving"`.

### D. Authority to Cancel Booked Transport (Ruling 11)

- **Role Widening**: `EVENT_ROLE.CANCEL_TRANSPORT` widened to `["coordinator", "ed", "ward", "community"]`.
- Originating wards and community teams can cancel transport they booked themselves (TR-D6 extension). Destination wards cannot cancel unilaterally.

### E. Terminal Referral Withdrawal Cascade (Ruling 8 / Invariant I-07)

- In `WITHDRAW_REFERRAL` and `RECORD_REFERRER_WITHDRAWAL`, any child movements or addressings linked via `movement.referralId` or `referral.id` are atomically transitioned to `withdrawn` / `did_not_proceed`.

### F. State Accounting on Revoked Examination (Ruling 9 / Invariant I-02)

- When `RECORD_EXAMINATION` results in a non-inpatient outcome (`"revoked"` or `"community_order"`), any reserved admissions (`admission.state === "pulled"`) are purged and any booked transport is cleanly cancelled without leaving orphaned reservations.

### G. Gender-Determines-Bed Gate (Ruling 5)

- Sex is documented and recorded; gender strictly determines bed allocation for male/female room designations and unit gender mix ratios.

---

## 3. Implementation Plan

1. **Step 1: Type Definitions (`ward-model.ts` & `ward-flow-events.ts`)**
   - Add `legalFormReceivedAt?: Instant` to `Movement`.
   - Add `receivedAt?: Instant` to `LegalForm`.
   - Add `FORM_1A_VALIDITY_MINUTES`, `FORM_1A_EXAMINATION_WINDOW_MINUTES`, and `FORM_3D_DETENTION_WINDOW_MINUTES` to `ward-model.ts` and allowlist in `tests/ward-legal-figure-guard.test.ts`.
   - Add `RECORD_LEGAL_FORM_RECEIVED` and `REFER_TO_COMMUNITY_TEAM` to `WardFlowEvent` union and `EVENT_ROLE` dictionary in `ward-flow-events.ts`.
   - Update `PERMISSIONS` dictionary in `tests/ward-event-permissions.test.ts`.

2. **Step 2: Reducer Implementation (`ward-flow-reducer.ts`)**
   - Handle `RECORD_LEGAL_FORM_RECEIVED`.
   - Handle `REFER_TO_COMMUNITY_TEAM`.
   - Update `PATIENT_ARRIVED` to accept `role === "ward"`.
   - Update `STEP_BACK_STAGE` with explicit `I-05` guard against `arrived` stage.
   - Update `WITHDRAW_REFERRAL` with `I-07` cascade.
   - Update `RECORD_EXAMINATION` with `I-02` reservation purge.

3. **Step 3: UI Controls (`ed-screen.tsx` & `ward-screen.tsx`)**
   - `ed-screen.tsx`:
     - Render Form 1A 72h validity clock and "Mark Form 1A received" button.
     - When received, render 24h psychiatric examination countdown clock.
     - Render Form 3D 72h detention clock.
     - Add "Refer to Community Team" button with `communityTeamOptions()` select dropdown.
   - `ward-screen.tsx`:
     - Render "Mark patient arrived" button in "Coming in" section for movements in `stage === "moving"`.

4. **Step 4: Verification Suite**
   - `npx vitest run tests/ward-owner-decisions-2026-09-16.test.ts`
   - `npx vitest run tests/ward-legal-figure-guard.test.ts`
   - `npx vitest run tests/ward-event-permissions.test.ts`
   - `npx vitest run tests/ward-ed-psychiatry-hub.dom.test.tsx`
   - `npx tsc -p tsconfig.typecheck.json --noEmit`
