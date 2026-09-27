# Owner decisions, 2026-09-16 — 16 rulings on clinical safety, statutory clocks, invariants, privacy, and CMHT flow

**Recorded by Antigravity / Pair Programming Assistant**  
**Worktree:** `d:\Worktrees\Database\ward-lead`  
**Branch:** `codex/task-ward-flow-live-state-20260831`  
**Governance:** Conforms to Owner Ruling **D-11** (two-ledger separation) and **D-8** (Ward Flow is strictly local, never pushed to `origin/main`).

---

## Executive Summary of the 16 Rulings

| #      | Topic                                                | Owner Ruling                                                                                                                                                                                                 |      Status       |
| ------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------: |
| **1**  | **Form 1A & 3D Statutory Clocks**                    | **72h validity clock when 1A written; explicit "Mark as Received" button in ED starts 24h examination clock. Form 3D starts 72h clock when placed. Option A: Advisory alert/breach with clinical override.** |   🟢 **RULED**    |
| **2**  | **`security` Gate Override**                         | **Overridable with recorded clinical safety / nursing specialling justification (extends D-9).**                                                                                                             |   🟢 **RULED**    |
| **3**  | **Form 4A Transport Order Pre-Condition**            | **Option B: Advisory warning only (allows booking ahead; transport officers verify physically on arrival).**                                                                                                 |   🟢 **RULED**    |
| **4**  | **High-Acuity Nursing Ratio Gate**                   | **Option B: Block pull when remaining capacity is 0, but permit coordinator override with NUM consultation.**                                                                                                |   🟢 **RULED**    |
| **5**  | **Gender-Determines-Bed Gate**                       | **Wire across movements & referrals. Sex documented; gender determines bed for male/female rooms and ratios.**                                                                                               |   🟢 **RULED**    |
| **6**  | **Physical Arrival Immutability (`I-05`)**           | **Arrival irreversible; must be explicitly recorded via dedicated "Mark Patient Arrived" button in Wards & ED.**                                                                                             |   🟢 **RULED**    |
| **7**  | **Transport Cancellation Decoupling (`I-04`)**       | **Owner requested further exploration and clarification.**                                                                                                                                                   | 🟡 **EXPLORING**  |
| **8**  | **Terminal Referral Withdrawal Cascade (`I-07`)**    | **Atomically transition child addressings to `withdrawn`.**                                                                                                                                                  |   🟢 **RULED**    |
| **9**  | **State Accounting on Revoked Examination (`I-02`)** | **Purge reserved admissions and cancel associated transport bookings on non-inpatient exam outcomes.**                                                                                                       |   🟢 **RULED**    |
| **10** | **Cross-Ward Movement Privacy (D-14)**               | **Option A: Ward users see only their own unit's movements; Central Flow Coordinators see full network history.**                                                                                            |   🟢 **RULED**    |
| **11** | **Authority to Cancel Booked Transport**             | **Wards and community teams may cancel transport they booked themselves.**                                                                                                                                   |   🟢 **RULED**    |
| **12** | **Exhaustive RBAC Permissions Matrix**               | **Owner requested further explanation of the 3 unmapped events and RBAC structure.**                                                                                                                         | 🟡 **EXPLAINING** |
| **13** | **ED Hub Authoritative Mockup Drawing**              | **Deferred for further explanation of drawing differences.**                                                                                                                                                 |  ⏸️ **DEFERRED**  |
| **14** | **Dual-Ledger Inbox Migration (27 Queued Items)**    | **Migrate queued ward requests directly into Ward Flow ledger (`PROJECT-ISSUES.md` / `ward-flow-task-ledger.md`).**                                                                                          |   🟢 **RULED**    |
| **15** | **Aboriginal Cultural Safety Review**                | **Deferred for now.**                                                                                                                                                                                        |  ⏸️ **DEFERRED**  |
| **16** | **ED to CMHT Referral Pathway**                      | **Build immediately as functional behavior ASAP (patients not needing admission but needing CMHT follow-up).**                                                                                               | 🔴 **BUILD ASAP** |

---

## Detailed Rulings & Clinical Rules Created

### Ruling 1 · Form 1A (72h / 24h with ED Received Button) & Form 3D (72h Clock)

> 🟢 **OWNER, verbatim:** _"1. Ok... Please edit and make this change for me. a Form 1A lasts 72 hours and 24 hours once received. When a 1A is written you start a 72 hour clock. Please also have a button in ED to mark it as Received and once that happens the 24 hour clock starts. For a 3D, once that has been placed, there is also a 72 hour clock that starts. Please ground this in your understanding of the mental health act in WA. Usually what happens is a 3D is done or another 1A... that last part is just context for you to have a better idea. Go with option A as well please otherwise."_

#### Clinical Grounding under WA Mental Health Act 2014

- **Form 1A (Referral for Examination by a Psychiatrist):**
  - **72-Hour Validity Clock:** Under §34(1)(b) and §35 of the WA MHA 2014, a Form 1A made by a medical practitioner or authorised mental health practitioner remains valid for **72 hours** from the time it is made (`formedAt`). The person must be received at an authorised hospital or general hospital / ED within this 72-hour window.
  - **ED "Mark as Received" Action:** When the patient physically presents at the ED / hospital, staff explicitly confirm receipt via a **"Mark as Received"** button. This records `receivedAt: now`.
  - **24-Hour Examination Countdown Clock:** Under §36 and §38, once received at the hospital, the person must be examined by a psychiatrist within **24 hours** of receipt (`receivedAt + 24h`).
- **Form 3D (Order Authorising Detention in Authorised Hospital for up to 72 hours):**
  - Once a Form 3D is placed, a **72-hour detention clock** starts (`placedAt + 72h`).
- **Option A (Advisory Alert with Clinical Override):**
  - At 20 hours (or near expiry), display an amber warning.
  - At 24/72 hours expiry, display a high-visibility red breach badge.
  - Bed placement / pull / transfer is NOT hard-blocked; clinicians can proceed with a mandatory recorded clinical justification ("Why proceeding under expired 1A / re-examination underway"), preserving the clinical record rather than driving unrecorded admissions.

#### Correction (17 September 2026)

Under owner rule D5, the Mental Health Act section numbers written into `ward-model.ts`, the
legal-figure guard's provenance strings, and the drawings under `docs/ward-flow/mockups/` have been
removed from product code, product comments and drawings. A guard,
`tests/ward-act-section-citation-guard.test.ts`, now scans `src/components/ward-management/`, the
mockups app, the drawings and the ward test suite for a reintroduced section number; its own file
header states its known limit — a section number below 20 with no "Mental Health Act"/"MHA"/"WAPOL"
wording or form code on the same line can still pass it unseen.

The section references in the Clinical Grounding text above (§34(1)(b), §35, §36, §38, at lines 41
and 43) are unverified and must not be relied on. Checked against the stored copy of the Act in
this repository (`data/mha-2014-sections.json`): some of the removed numbers — 26, 34, 36, 61 and
112 among them — exist there, but under a heading that does not match the label the drawings or the
model gave them; others — 15, 44, 52 and 58 among them — are not in the stored copy at all. The
owner's own legal questions about these figures remain open.

#### Superseded 17 September 2026 by owner answers 1 and 3

The 72-hour and 24-hour figures in the Clinical Grounding text above, and the "72-Hour Validity
Clock" / "24-Hour Examination Countdown Clock" / "72-hour detention clock" behaviour they describe,
no longer reflect what this prototype does. Put to him again on 17 September 2026
(`docs/ward-flow/owner-answers-2026-09-17.md`, item 1), the owner's answer is narrower than the
figures Ruling 1 approved above: **the app works out no legal time limits of its own.** The
clinician types the expiry written on the form they are holding, and the app records and shows back
exactly that typed value — never a duration computed from a form code, and never one of the hour
figures above added to a start time. Item 3 of the same set of answers restates the standing rule
already acted on in the Correction just above: no Mental Health Act section numbers appear anywhere
in this prototype.

**So every figure and every section reference in the Clinical Grounding text and this Correction
section — the 72-hour and 24-hour clocks, §34(1)(b), §35, §36, §38 — must not be used to justify or
reconstruct any computed limit in this codebase.** They are left in place above as a historical
record of what was asked and approved on 16 September 2026, not as a current specification. The
owner's own words at the top of this ruling are unedited and stay exactly as he wrote them; this
block is the correction that supersedes the behaviour built from them, not a rewrite of what he
said. `src/components/ward-management/ward-model.ts` (`FORM_1A_VALIDITY_HOURS`,
`FORM_1A_EXAMINATION_WINDOW_HOURS`, `FORM_3D_DETENTION_WINDOW_HOURS`, deleted) and
`tests/ward-legal-figure-guard.test.ts` (its provenance property, replacing the code allowlist those
three constants were once entered against) are where the correction actually took effect
(`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`, task T2).

---

### Ruling 2 · `security` Gate is Overridable (Extending D-9)

> 🟢 **OWNER, verbatim:** _"2. Go ahead with recommendation"_

#### Clinical Rule Created

- Extends Owner Ruling **D-9** (authorisation gate override): The `security` suitability gate (e.g. allocating an involuntary patient to an open ward bed, or vice-versa) is **overridable by a named bed coordinator** with a mandatory recorded clinical justification (e.g., "1:1 nursing special allocated on open ward due to zero secure beds available statewide").
- Rationale: An un-overridable gate does not stop the admission under extreme bed pressure; it merely stops the admission from being recorded truthfully in the system.

---

### Ruling 3 · Form 4A Transport Order Advisory Warning (Option B)

> 🟢 **OWNER, verbatim:** _"3. No... There is a warning. This is so it can be booked. When the officers get there they will always ask for it so Option B is fine."_

#### Clinical Rule Created

- External patient transport (e.g. St John Ambulance, Secure Transport) may be booked in advance without hard-blocking on Form 4A existence.
- The UI renders a prominent clinical warning banner reminding staff: _"Involuntary transfer: Form 4A transport order must be signed and provided to transport officers on collection."_
- Rationale: Booking in advance avoids transport logistical delays; transport officers verify the physical/electronic Form 4A upon vehicle arrival before departing.

---

### Ruling 4 · High-Acuity Nursing Ratio Gate with NUM Override (Option B)

> 🟢 **OWNER, verbatim:** _"4. Option B... this allows flexibility since extra staffed can be rostered also when needed"_

#### Clinical Rule Created

- When a ward's remaining high-acuity capacity is 0 (`remainingHighAcuityCapacity === 0`), `PULL_PATIENT` is blocked by default.
- A bed coordinator or Nurse Unit Manager (NUM) may override the block by recording an explicit clinical consultation reason (e.g. "Overtime specialling nurse rostered for shift").

---

### Ruling 5 · Gender Determines Bed Allocation Across Movements & Referrals

> Superseded 17 Sept 2026 by `docs/ward-flow/owner-answers-2026-09-17.md` items 8 and 9 and R2-2: gender is recorded at referral; "unknown" is refused only on single-gender wards; a non-binary patient may be placed on a single-gender ward with a coordinator's recorded reason.

> 🟢 **OWNER, verbatim:** _"5. Yes to your recommendation. Sex is documented and on the record but gender determines what bed when there is female or male beds and gender ratios on the ward."_

#### Clinical Rule Created

- Wire the sex/gender gate into movement search and referral intake.
- `sex` is documented and fixed on the patient record; `gender` strictly determines room/bay eligibility (e.g. female-only rooms/bays). A trans woman is accommodated as a woman. If gender is "not yet recorded", the system flags it and blocks single-sex bay allocation until confirmed.

---

### Ruling 6 · Physical Arrival Immutability with Explicit Confirmation Buttons

> 🟢 **OWNER, verbatim:** _"6. ok... yes to your recommendation.. however, it must be explicitly recorded. A button for the wards and for ED to be pressed when they are aware that a patient has explicitly arrived."_

#### Clinical Rule Created

- Invariant **`I-05`** is strictly enforced: `STEP_BACK_STAGE` cannot reverse a movement once `stage === "arrived"`.
- Arrival must be **explicitly confirmed by a human**:
  - ED screen carries an explicit button: **"Mark Patient Arrived in ED"** (`RECORD_ARRIVED_IN_DEPARTMENT`).
  - Ward screen carries an explicit button: **"Confirm Patient Arrived on Ward"** (`CONFIRM_PATIENT_ARRIVED`).
  - Administrative mis-allocations must be resolved via formal compensatory transfer or cancellation, preserving physical timestamps.

---

### Ruling 7 · Transport Cancellation Decoupling (`I-04`) — Exploration

> 🟡 **OWNER, verbatim:** _"7. No... explore this further i am confused."_

#### Status

- Under active exploration. Detailed explanation and clinical scenarios provided in handover response to guide the final decision.

#### ✅ CLOSED 2026-09-17

`docs/ward-flow/owner-answers-2026-09-17.md` item 30 gives the explanation he asked for: "Cancelling
transport while a bed is held: no automatic rebooking; a person books again." Explained in full:
**cancelling transport never books another vehicle or marks the patient ready by itself — a person
does each of those, separately, every time.** No further exploration is owed; this stands as the
answer.

---

### Ruling 8 · Terminal Referral Withdrawal Cascade (`I-07`)

> 🟢 **OWNER, verbatim:** _"8. Yes please to your recommendation"_

#### Clinical Rule Created

- Enforce Invariant **`I-07`**: When a referral transitions to `withdrawn` via `WITHDRAW_REFERRAL`, all child addressings in ward inboxes atomically transition to `withdrawn`. Subsequent pull attempts fail closed.

---

### Ruling 9 · State Accounting on Revoked Examination (`I-02`)

> Superseded 17 Sept 2026 by `docs/ward-flow/owner-answers-2026-09-17.md` item 6: after transport is booked the bed is kept and flagged, not refunded automatically; a person decides.

> 🟢 **OWNER, verbatim:** _"9. Yes to your recommendation"_

#### Clinical Rule Created

- Enforce Invariant **`I-02`**: When `RECORD_EXAMINATION` finishes with a non-inpatient outcome (`outcome: "revoked"` or `"community_order"`), any reserved admissions and transport jobs are atomically cleaned up. Bed capacity is refunded cleanly with zero orphaned records.

---

### Ruling 10 · Cross-Ward Movement History Privacy Boundary (Ruling D-14)

> 🟢 **OWNER, verbatim:** _"10. Option A please your recommendation"_

#### Clinical Rule Created

- Enforce Owner Ruling **D-14**:
  - **Ward-level staff** see only admissions, movements, and referrals that originate from or terminate at their own ward. They cannot see destinations where a patient was declined by other units.
  - **Central Bed Coordinators / Flow Leads** retain full network visibility for audit and system coordination.

---

### Ruling 11 · Authority to Cancel Booked Transport

> Refined 17 Sept 2026 by `docs/ward-flow/owner-answers-2026-09-17.md` item 24 and R2-9: community teams can cancel transport, and only the community team that booked it.

> 🟢 **OWNER, verbatim:** _"11. Yes to your recommendation"_

#### Clinical Rule Created

- Permitted callers for `CANCEL_TRANSPORT` widened from `["coordinator", "ed"]` to include the **originating ward or community team** that booked the vehicle (`["coordinator", "ed", "ward", "community"]`). Destination wards cannot cancel unilaterally.

---

### Ruling 12 · Exhaustive RBAC Permissions Matrix Mapping — Explanation

> 🟡 **OWNER, verbatim:** _"12. Please explain this further for me"_

#### Status

- Under active explanation. Detailed breakdown of RBAC principles, unmapped events, and default-deny protection provided in handover response.

#### ✅ CLOSED 2026-09-17

`docs/ward-flow/owner-answers-2026-09-17.md` item 62: "Close the already-answered records and the two
rulings about things that no longer exist." **This is one of the two.** The events and file this
ruling names do not exist in the codebase, so there is nothing further to explain or to build; the
explanation this ruling asked for is that the thing it describes was never real.

---

### Ruling 13 · ED Hub Authoritative Mockup Drawing — Deferred

> Superseded 17 Sept 2026 by `docs/ward-flow/owner-answers-2026-09-17.md` item 42: the ED "third edition" drawing is the ED drawing.

> ⏸️ **OWNER, verbatim:** _"13. Please defer this for me and explain further i am not sure as it is a big decision."_

#### Status

- Deferred as requested. Explanation of the two filenames and confirmation of the single third-edition drawing provided in handover response.

---

### Ruling 14 · Dual-Ledger Inbox Migration of 27 Queued Items

> 🟢 **OWNER, verbatim:** _"14. Yes please goa head with this."_

#### Action Created

- Migrate the 27 queued ward requests from `docs/outstanding-issues-inbox/` directly into `docs/ward-flow/PROJECT-ISSUES.md` and `docs/ward-flow-task-ledger.md`, cleanly bypassing the main project ledger as required by Ruling **D-11**.

---

### Ruling 15 · Aboriginal Cultural Safety Review — Deferred

> Confirmed 17 Sept 2026 by `docs/ward-flow/owner-answers-2026-09-17.md` R2-6: deferred by the owner; do not ask again. It stays a hard gate before any real-patient use.

> ⏸️ **OWNER, verbatim:** _"15. Please defer this for now"_

#### Status

- Deferred as requested. Internal prototype tests continue with explicit disclosure marker.

---

### Ruling 16 · Direct ED-to-CMHT Referral Pathway — Build ASAP

> 🔴 **OWNER, verbatim:** _"16. Yes. I want you to build this behaviour and functional now ASAP as ED to CMHT referrals are very common. This is when patients do not need admission but do need CMHT follow-up"_

#### Functional Requirement Created

- Build the active ED-to-CMHT (Community Mental Health Team) referral pathway immediately.
- When an ED patient does not require psychiatric inpatient admission but needs community follow-up, the ED clinician must be able to select and dispatch a referral directly to the patient's catchment CMHT.
- Wire into `ed-screen.tsx`, `referral-destination-options.ts`, and `referral-intake.tsx`.
