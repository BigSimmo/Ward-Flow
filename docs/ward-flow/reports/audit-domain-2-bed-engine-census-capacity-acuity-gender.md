# Ward Flow Audit Report: Domain 2 — Bed Engine, Census, Capacity, Acuity & Gender Segregation Logic

**Auditor:** Agent 2 (Bed Engine, Census, Capacity, Acuity & Gender Segregation Logic)  
**Target Codebase:** `D:/Worktrees/Database/ward-lead`  
**Scope:** `src/components/ward-management/board/ward-board.tsx`, `ward/ward-screen.tsx`, `capacity/capacity-screen.tsx`, `capacity/bed-map.tsx`, `hub/hub-screen.tsx`, `coordinator/coordinator-screen.tsx`, `ward-model.ts`, `ward-derivations.ts`, `ward-flow-reducer.ts`, `ward-eligibility.ts`, and associated tests (`tests/ward-capacity*`, `tests/ward-gender*`, `tests/ward-board*`, `tests/ward-acuity*`, `tests/ward-agent2-stress-test.test.ts`).

---

## 1. Executive Summary & Verdict

The Ward Flow bed engine and census subsystem implements sophisticated, multi-layered safeguards around clinical patient flow, bed tracking, and nurse unit manager (NUM) oversight. Non-binary placement rules fail closed reliably on invalid or whitespace reasons, high-acuity overrides enforce strict offline validation gates, and nominal bed transitions maintain state immutability.

However, forensic stress testing and automated adversarial test execution (`tests/ward-agent2-stress-test.test.ts`) have revealed **7 confirmed defects across 4 severity tiers**:

1. **CRITICAL: Gender Segregation Breach via Direct Arrival (`noTransportNeeded`) & In-Transit Correction**  
   `PATIENT_ARRIVED` in `ward-flow-reducer.ts` deliberately omits gender designation validation (`heldUnitGenderRefusal`). If a patient's clinical gender is corrected from Female to Male while awaiting direct ward transfer (`pulled` stage with `noTransportNeeded`) or while in transit (`moving` stage), the ward can confirm arrival without error. A male patient is placed directly onto a female-only ward, causing a serious clinical governance and safety breach.
2. **HIGH: Disappearing Blocked Beds when Ward is Physically Empty**  
   In `ward-derivations.ts:571-573`, `unitCapacity` calculates blocked beds as `Math.min(unit.blocked, notEmpty)` where `notEmpty = beds - empty.value`. When all beds are empty (`empty.value === beds`), `notEmpty` is 0. Consequently, `capacity.blocked` drops to `0`, and maintenance/closed beds are erroneously reclassified into `capacity.held`. Clinicians are shown closed beds as operational capacity.
3. **HIGH: Unhandled Capacity Screen Crash on Zero Free Beds (`bed-map.tsx`)**  
   In `bed-map.tsx:79-84`, `bedMapWards` executes: `if (pendingPreparation > capacity.available) throw new Error(...)`. When a ward is 100% full (`available = 0`) and has a bed undergoing terminal cleaning (`pendingPreparation = 1`), opening the Capacity Screen throws an uncaught JavaScript error that crashes the view.
4. **HIGH: Transgender Bay-Mix Inversion (`sex_mix` Gate)**  
   In `ward-eligibility.ts:116` & `209-215`, the `gender_designation` gate correctly checks `movement.gender`, but the `sex_mix` gate checks `unit.sexMix[movement.sex]`. For a transgender woman (`gender: "Female"`, `sex: "Male"`), the bed mix evaluates biological sex. On a ward with female occupants, she is treated as a solitary male and rejected; on a ward with male occupants, she is admitted alongside men, violating Owner Ruling 5 ("a trans woman is accommodated as a woman").
5. **HIGH: Uncaught TypeError in `BOOK_TRANSPORT` on Undefined `movement.unwinds`**  
   In `ward-flow-reducer.ts:6536`, `movement.unwinds.filter(...)` fails with an uncaught `TypeError` if a movement object lacks an initialized `unwinds` array, crashing the reducer during ambulance booking.
6. **HIGH: 100% Capacity Overcapacity Concealment**  
   When a ward is at 100% capacity (`empty.value <= 0`), `PATIENT_ARRIVED` admits the patient with an `"Arrived — Bed Turnaround"` blocker. However, `unitCapacity` (`ward-derivations.ts`) clamps `occupied` to `unit.beds`. The 21st patient on a 20-bed ward is concealed from all capacity summary bars, while the Ward Board renders 21 tiles, causing immediate clinical disorientation.
7. **MEDIUM: Permanent Census Drift in `RELEASE_BED`**  
   In `ward-flow-reducer.ts:4940-4978`, `RELEASE_BED` increments `empty` and `allocatable` and removes the admission, but fails to decrement `unit.sexMix`. `sum(sexMix)` and `occupied` permanently diverge until a full page reload or telemetry reset.

---

## 2. Bed Capacity Mathematics & Closed Bed Accounting

### 2.1 Broken Partition Invariant on Zero Beds or Feed Glitches

- **File & Lines:** `src/components/ward-management/ward-derivations.ts:568-575`
- **Mechanism:**  
  The mathematical contract of `UnitCapacity` stipulates that its categories must partition `unit.beds`:
  $$\text{available} + \text{held} + \text{blocked} + \text{occupied} = \text{beds}$$
  In `unitCapacity`:
  ```ts
  const notEmpty = Math.max(unit.beds - unit.empty.value, 0);
  const blocked = Math.min(Math.max(unit.blocked, 0), notEmpty);
  const occupied = Math.max(notEmpty - blocked, 0);
  const available = Math.min(unit.allocatable.value, unit.empty.value);
  const held = Math.max(unit.empty.value - available, 0);
  ```
  Notice that `available` and `held` depend purely on `empty.value` without being clamped to `unit.beds`.
- **Stress-Test Finding (Scenario 1):**  
  When a ward has `unit.beds = 0` (e.g. a decommissioned ward or unconfigured site), but an upstream feed reports `empty.value = 2` and `allocatable.value = 2`:
  - `notEmpty = 0`, `blocked = 0`, `occupied = 0`.
  - `available = 2`, `held = 0`.
  - Total partitioned beds = $2 \neq 0$.
- **Clinical Impact:**  
  Coordinators and bed managers see phantom beds available for allocation on a unit with 0 physical beds.

### 2.2 Closed / Blocked Beds Disappear on Physically Empty Wards

- **File & Lines:** `src/components/ward-management/ward-derivations.ts:571-573`
- **Mechanism:**  
  `blocked` is derived as `Math.min(Math.max(unit.blocked, 0), notEmpty)`.  
  `notEmpty` represents the beds that are NOT empty: `Math.max(unit.beds - unit.empty.value, 0)`.  
  If a ward is completely empty of patients (`empty.value === unit.beds`), then `notEmpty = 0`.  
  Therefore:
  $$\text{blocked} = \min(\text{unit.blocked}, 0) = 0$$
  Meanwhile, `held` is computed as:
  $$\text{held} = \max(\text{empty.value} - \text{available}, 0)$$
- **Stress-Test Finding (Scenario 2):**  
  Consider a 20-bed ward with 0 patients admitted (`empty.value = 20`), but 5 beds closed for maintenance or infection control (`unit.blocked = 5`, `allocatable.value = 15`):
  - `notEmpty = 0`.
  - `capacity.blocked = 0`! (The 5 blocked beds completely disappear from the blocked count).
  - `capacity.available = 15`.
  - `capacity.held = 20 - 15 = 5`!
- **Clinical Impact:**  
  Maintenance beds are displayed to bed coordinators as "Held" beds rather than "Blocked" beds. A coordinator looking at the dashboard assumes 5 beds are reserved for incoming transfers rather than broken or quarantined.

### 2.3 Unhandled Capacity Screen Crash on Zero Free Beds

- **File & Lines:** `src/components/ward-management/capacity/bed-map.tsx:79-84`
- **Mechanism:**  
  When generating bed tiles for a ward, `bedMapWards` allocates pending cleaning beds from available beds:
  ```ts
  if (pendingPreparation > capacity.available) {
    throw new Error(
      `Invariant violation: pendingPreparation (${pendingPreparation}) exceeds available (${capacity.available}) on unit ${unit.id}`,
    );
  }
  ```
- **Stress-Test Finding (Scenario 3):**  
  When a 20-bed ward is full (`capacity.available = 0`), and a patient is discharged, leaving 1 bed awaiting terminal cleaning (`pendingPreparation = 1`), `pendingPreparation (1) > capacity.available (0)`.  
  Instead of rendering the bed as "cleaning" or capping the count, the component throws an uncaught runtime exception.
- **Clinical Impact:**  
  The entire Capacity Screen (`/capacity`) crashes with a React error boundary when any ward in the hospital is full with a dirty bed.

### 2.4 Overcapacity Concealment at 100% Occupancy

- **File & Lines:** `src/components/ward-management/ward-flow-reducer.ts:4142-4165` vs `ward-derivations.ts:568-575`
- **Mechanism:**  
  When a patient arrives and `unit.empty.value <= 0`, `PATIENT_ARRIVED` does NOT fail closed:
  ```ts
  const isBedTurnaround = empty <= 0;
  const blocker = isBedTurnaround ? STAGE_TRANSITION_BLOCKERS.bedTurnaround : undefined;
  ```
  It adds the patient to `unit.admissions`.  
  However, in `unitCapacity`:
  ```ts
  const notEmpty = Math.max(unit.beds - unit.empty.value, 0); // clamped to unit.beds
  const occupied = Math.max(notEmpty - blocked, 0);
  ```
- **Clinical Impact:**  
  If a 21st patient arrives on a 20-bed ward, `capacity.occupied` remains 20 (clamped). The summary bars and occupancy percentages display 100% (20/20) while the Ward Board renders 21 physical tiles. There is no explicit surge bed designation; overcapacity is silently masked in executive dashboards.

---

## 3. Gender Segregation & Placement Rules

### 3.1 Critical Breach: Direct Arrival Bypass (`noTransportNeeded`)

- **File & Lines:** `src/components/ward-management/ward-flow-reducer.ts:4077-4140`
- **Mechanism:**  
  `heldUnitGenderRefusal` is invoked during `PULL_PATIENT`, `HANDOVER_READY`, `TRANSPORT_ACCEPTED`, and `PATIENT_COLLECTED`.  
  However, `PATIENT_ARRIVED` **deliberately contains no check**:
  ```ts
  // Line 4060: The last of the four re-checks: PATIENT_ARRIVED deliberately has none.
  ```
  When a patient is internal or walking from ED (`noTransportNeeded: true`), they transition directly from `pulled` to `arrived`.  
  If their gender is corrected in the clinical chart (`RECORD_MOVEMENT_GENDER`) after `PULL_PATIENT`:
  - `RECORD_MOVEMENT_GENDER` emits an advisory notice (`gender_corrected_after_hold`), but does NOT step back the stage or cancel the bed hold.
  - The ward staff clicks "Confirm Arrival" (`PATIENT_ARRIVED`).
  - The engine admits the patient without error.
- **Stress-Test Finding (Scenario 4):**  
  An automated test verified that a patient whose gender was corrected from Female to Male while at `stage: "pulled"` successfully executed `PATIENT_ARRIVED` onto a `Female only` ward (`state.movements.find(...).stage === "arrived"` with zero rejections).
- **Clinical Impact:**  
  **Severe breach of clinical segregation policy.** A male patient is formally admitted and placed into an acute female-only psychiatric ward bed.

### 3.2 Critical Breach: In-Transit Gender Correction

- **File & Lines:** `src/components/ward-management/ward-flow-reducer.ts:4059-4061` & `4077-4140`
- **Mechanism:**  
  Even when external transport is used, `PATIENT_COLLECTED` is the last point where `heldUnitGenderRefusal` runs. Once in transit (`stage: "moving"`):
  - A clerk or coordinator identifies an intake error and updates the patient's record to Male via `RECORD_MOVEMENT_GENDER`.
  - When the ambulance arrives at the hospital, the receiving ward logs `PATIENT_ARRIVED`.
  - Because `PATIENT_ARRIVED` lacks a gender guard, the patient is admitted to the incompatible ward.
- **Stress-Test Finding (Scenario 5):**  
  Verified via automated test `tests/ward-agent2-stress-test.test.ts`. A male patient in transit arrived on a female-only ward without rejection.
- **Clinical Impact:**  
  Ambulance transfers with late-discovered gender records bypass segregation gates and land on single-gender wards.

### 3.3 Transgender Bay-Mix Inversion (`sex_mix` Gate)

- **File & Lines:** `src/components/ward-management/ward-eligibility.ts:116` & `209-215`
- **Mechanism:**  
  `ward-eligibility.ts` implements two distinct gender gates:
  1. `gender_designation`: Evaluates `movement.gender` against `unit.sexDesignation`. (Correct).
  2. `sex_mix`: Evaluates `movement.sex` against `unit.sexMix`:
     ```ts
     sex_mix: (movement, unit) => {
       const sex = movement.sex;
       if (sex !== "Male" && sex !== "Female") return { eligible: true };
       const currentCount = unit.sexMix[sex];
       ...
     }
     ```
- **Defect:**  
  In `ward-model.ts`, `sex` is biological/legal sex, whereas `gender` is affirmed gender identity.  
  For a transgender woman (`gender: "Female"`, `sex: "Male"`):
  - On a mixed-gender ward currently occupied only by women, her `sex` (`Male`) is checked against `unit.sexMix["Male"]` (which is 0). If only 1 bed remains, she is refused because admitting her would "introduce a lone male into an all-female room".
  - On a ward currently occupied only by men, she is admitted because her `sex` matches the existing male occupants.
- **Clinical Impact:**  
  This directly violates Owner Ruling 5: _"A trans woman is accommodated as a woman."_ Transgender patients are segregated according to biological sex rather than affirmed gender.

### 3.4 Non-Binary Placement Rules (Owner Ruling R2-2)

- **File & Lines:** `ward-flow-reducer.ts:2836-2844` (`REFER_TO_UNITS`), `5533-5541` (`ACCEPT_REFERRAL`), `shortlist-panel.tsx:1265`
- **Rule Verification:**
  - Placing a non-binary patient on a single-gender ward (`"Male only"` or `"Female only"`) requires a documented clinical reason (`GenderPlacementReason`).
  - Placing on a `"Mixed"` ward requires NO reason.
- **Stress-Test Evaluation:**
  - **Missing Reason:** `ward-flow-reducer.ts` checks `GENDER_PLACEMENT_REASONS.includes(event.genderPlacement?.reason)`. If omitted or undefined, it fails closed with `GENDER_PLACEMENT_REFUSAL`.
  - **Empty String or Whitespace:** Because `""` and `"   "` are not members of `GENDER_PLACEMENT_REASONS`, the engine rejects them. Furthermore, UI forms (`shortlist-panel.tsx` line 1265 and `referral-match.tsx` line 1446) disable the submission button when `reason.trim().length === 0`.
- **Verdict:** **SOLID (Passes Audit).** Fail-closed behavior is verified.

---

## 4. Acuity & NUM Tick Requirements

### 4.1 High-Acuity Override Gate

- **File & Lines:** `src/components/ward-management/ward-flow-reducer.ts:3512-3523` (`PULL_PATIENT`)
- **Mechanism:**  
  When a patient is marked `highAcuity: true`, `PULL_PATIENT` calculates `remainingHighAcuityCapacity`. If $\le 0$, the pull is rejected unless:
  1. `event.overrideReason` is defined and belongs to `OVERRIDE_REASONS`.
  2. `event.numConsulted === true` (explicit confirmation that the Nurse Unit Manager was consulted).
- **Stress-Test Evaluation:**
  - If `numConsulted` is false or omitted, the pull is rejected: `"cannot pull high-acuity patient ... Nurse Unit Manager (NUM) consultation must be confirmed"`.
  - If `overrideReason` is missing, the pull is rejected: `"cannot pull high-acuity patient ... an override reason must be supplied"`.
- **Verdict:** **SOLID (Passes Audit).**

### 4.2 Transient NUM Tick Persistence Hole

- **File & Lines:** `src/components/ward-management/ward-flow-reducer.ts:3747-3755`
- **Defect:**  
  While `numConsulted: true` is verified at the moment of `PULL_PATIENT` and recorded into `movement.overrides`, the resulting `Admission` record created upon `PATIENT_ARRIVED` does NOT carry `numConsulted` or `overrideReason`.
- **Clinical Impact:**  
  Once a high-acuity patient is admitted, their admission tile on the ward board and in governance audits shows `highAcuity: true` without evidence that the NUM authorized the over-acuity placement.

### 4.3 Acuity Bounds & Arithmetic Integrity

- **File & Lines:** `src/components/ward-management/ward-derivations.ts:530-555`
- **Mechanism:**  
  `remainingHighAcuityCapacity` safely handles non-integer, negative, or NaN authored limits:
  ```ts
  const total = Math.max(0, Math.floor(authored));
  ```
  However, `unit.acuity.high` is read directly from incoming feed objects without schema validation at the ingestion boundary.

---

## 5. Adversarial Scenarios & Engine Crashes

### 5.1 Uncaught Crash in `BOOK_TRANSPORT` (`movement.unwinds`)

- **File & Lines:** `src/components/ward-management/ward-flow-reducer.ts:6536`
- **Defect:**
  ```ts
  const priorTransportCancellations = movement.unwinds.filter((entry) => entry.kind === "transport_cancelled").length;
  ```
  In `ward-model.ts`, `unwinds` is defined as optional: `unwinds?: MovementUnwind[]`. If a movement is constructed or imported without `unwinds: []`, calling `BOOK_TRANSPORT` throws:
  `TypeError: Cannot read properties of undefined (reading 'filter')`.
- **Severity:** High (Crashes application runtime for affected movements).

### 5.2 Permanent State Drift in `RELEASE_BED`

- **File & Lines:** `src/components/ward-management/ward-flow-reducer.ts:4940-4978`
- **Mechanism:**  
  When a bed hold is released (`RELEASE_BED`), the reducer increments `empty` and `allocatable`, and removes the movement from `heldMovements`.  
  However, if the bed was already marked in `sexMix` during allocation, `RELEASE_BED` never decrements `unit.sexMix`.
- **Clinical Impact:**  
  The gender occupancy counts (`unit.sexMix`) drift permanently higher than actual occupancy, causing false gender-mix lockouts for subsequent patients.

### 5.3 Duplicate Movement IDs on Arrival

- **File & Lines:** `src/components/ward-management/ward-flow-reducer.ts:4131`
- **Mechanism:**  
  `admissionId` is generated as `ADM-${movement.id}`. If an upstream message re-dispatches arrival or reuses a movement ID, duplicate admission IDs are inserted into `unit.admissions`. The Ward Board key iterator encounters duplicate keys, causing React rendering glitches.

---

## 6. Summary Table of Audit Findings

| ID        | Location                           | Severity     | Defect Summary                                                                                        | Clinical Impact                                                                |
| --------- | ---------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **D2-01** | `ward-flow-reducer.ts:4077-4140`   | **CRITICAL** | `PATIENT_ARRIVED` omits gender designation validation for direct arrivals (`noTransportNeeded`).      | Male patient placed onto female-only psychiatric ward after gender correction. |
| **D2-02** | `ward-flow-reducer.ts:4059-4061`   | **CRITICAL** | `PATIENT_COLLECTED` is the last gender check; in-transit gender corrections bypass `PATIENT_ARRIVED`. | In-transit gender corrections land on incompatible single-gender wards.        |
| **D2-03** | `ward-derivations.ts:571-573`      | **HIGH**     | `capacity.blocked` clamped to `notEmpty`; disappears when ward is empty (`empty === beds`).           | Closed/maintenance beds appear as operational "Held" beds to coordinators.     |
| **D2-04** | `bed-map.tsx:79-84`                | **HIGH**     | `throw new Error` when `pendingPreparation > capacity.available`.                                     | Capacity screen crashes when a full ward has a discharged bed being cleaned.   |
| **D2-05** | `ward-eligibility.ts:116, 209-215` | **HIGH**     | `sex_mix` checks `movement.sex` (biological sex) rather than affirmed `movement.gender`.              | Transgender women evaluated as men in bay mix, violating Owner Ruling 5.       |
| **D2-06** | `ward-flow-reducer.ts:6536`        | **HIGH**     | `movement.unwinds.filter(...)` throws uncaught TypeError when `unwinds` is undefined.                 | Crash during ambulance booking (`BOOK_TRANSPORT`).                             |
| **D2-07** | `ward-derivations.ts:568-575`      | **HIGH**     | `unitCapacity` clamps `occupied` to `unit.beds`, hiding 21st patient on 20-bed ward.                  | Silent overcapacity; dashboard claims 100% while board shows 21 patients.      |
| **D2-08** | `ward-flow-reducer.ts:4940-4978`   | **MEDIUM**   | `RELEASE_BED` does not adjust `unit.sexMix`.                                                          | Permanent census drift causing phantom gender lockout.                         |
| **D2-09** | `ward-flow-reducer.ts:3747`        | **MEDIUM**   | NUM consultation tick is not copied from `movement.overrides` to `Admission`.                         | Loss of audit trail for high-acuity admission authorizations.                  |
| **D2-10** | `ward-derivations.ts:568-575`      | **MEDIUM**   | `available` and `held` not clamped to `unit.beds` when `unit.beds = 0`.                               | Phantom bed capacity displayed on 0-bed units.                                 |

---

## 7. Actionable Recommendations & Remediation Plan

1. **Add `heldUnitGenderRefusal` to `PATIENT_ARRIVED`:**  
   In `ward-flow-reducer.ts:4080`, call `heldUnitGenderRefusal(state, movement, event.now)`. If it returns a refusal reason, reject `PATIENT_ARRIVED` and route the movement to an escalation status requiring bed coordinator reassignment.
2. **Step Back Movements on `RECORD_MOVEMENT_GENDER`:**  
   When gender is corrected on a movement that is already `accepted_awaiting_bed`, `pulled`, or `moving`, automatically unwind or transition the movement to `placement_requested` / `destination_review` if the held unit is incompatible.
3. **Fix `blocked` Derivation in `unitCapacity`:**  
   In `ward-derivations.ts:571-573`, compute blocked beds independently of patient empty count:
   $$\text{blocked} = \min(\max(\text{unit.blocked}, 0), \text{unit.beds})$$
   $$\text{operationalBeds} = \text{unit.beds} - \text{blocked}$$
   $$\text{empty} = \min(\text{unit.empty.value}, \text{operationalBeds})$$
4. **Remove Hard Throw in `bed-map.tsx`:**  
   Replace `throw new Error(...)` with `const displayPrep = Math.min(pendingPreparation, capacity.available)`.
5. **Harmonize `sex_mix` with `gender`:**  
   In `ward-eligibility.ts:209-215`, use `movement.gender` for bay mixing, or support explicit clinical room designation per Owner Ruling 5.
6. **Defensive Optional Chaining in `BOOK_TRANSPORT`:**  
   Change line 6536 to `(movement.unwinds ?? []).filter(...)`.
