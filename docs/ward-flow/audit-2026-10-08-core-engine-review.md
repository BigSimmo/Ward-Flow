# Core engine review — 8 October 2026

Task: review Ward Flow's core engine for correctness bugs, requested by Josh as a "super review". Read-only review; no source was changed. Base `origin/main` at `e7b7f32`. Synthetic data only.

## Scope and method

The core engine is about 14,850 lines, above ultrareview's 8,000-line limit for one run, so it was split into two slices:

| Slice | Files                                                                                                                                                                                                                                   | Lines |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1     | `ward-flow-reducer.ts` lines 1–4536, `ward-model.ts`                                                                                                                                                                                    | 7,684 |
| 2     | `ward-flow-reducer.ts` lines 4537–9093 (from `case "TRANSPORT_ACCEPTED"`), `ward-eligibility.ts`, `ward-admissions.ts`, `ward-inbox-reducer.ts`, `alerts/ward-broadcast-*.ts`, `referrals/referral-submission.ts`, `ward-bed-states.ts` | 7,169 |

All paths are under `src/components/ward-management/`. A local-only scaffold branch gives each slice its own review base; the script that builds it is [`audit-artefacts/ultrareview-core-engine.sh`](audit-artefacts/ultrareview-core-engine.sh). It never pushes, and the branch tip is identical to `main`.

`/code-review ultra` was launched from a cloud session, where ultrareview is not available. It fell back to a local review. The first attempt hit the session limit: the conventions check completed and nine finder agents stopped before writing any findings. The restarted run was one reviewer in a single pass, with no multi-agent fan-out and no separate verification pass. These findings therefore come from reading the code only. No test reproduced them.

## Status

- Slice 1: reviewed. 14 findings below, plus a clean conventions check.
- Slice 2: reviewed. 15 findings below, plus a clean conventions check.
- All 29 findings checked on 8 October 2026: 21 reproduced by replaying them against the real reducer, 7 confirmed by reading the code, 1 only partly confirmed. See [Verification](#verification).
- No findings fixed yet.

## Slice 1 findings

Line numbers refer to `src/components/ward-management/ward-flow-reducer.ts` at `e7b7f32` unless another file is named. Findings 9, 10, 11 and 12 depend on a dispatch that bypasses the TypeScript types or omits a field. Finding 12 cannot occur today, because the only screen that sends that event sends it as coordinator.

### 1. Discharge allowed while the patient is leaving in transit (line 1878) — most serious

The "discharge blocked while in transit" guard only checks the movement that `dischargeMovement` returns. That is the inbound movement for this stay, which has already arrived, or an open movement with no `admissionId`. A ward-to-ward or repatriation movement leaving the stay is never checked.

Scenario: the patient occupies AD-1, which they reached via WF-1 (closed, arrived). Ward-to-ward movement WF-2 is raised from AD-1, pulled at another ward (so it now has its own `admissionId`) and collected. `RECORD_PATIENT_DISCHARGE` on AD-1 finds WF-1, the guard passes and AD-1 departs. `PATIENT_ARRIVED` for WF-2 then refuses ("Repatriation arrival needs the patient's occupied source stay"), and `PULL_PATIENT` refuses the same way. The patient is stuck in transit, and the movement can never close as arrived.

### 2. Bed pull can admit a different patient from the one it checked (line 4304)

`PULL_PATIENT` runs the one-bed-per-patient check on `movement.patientId ?? referral.patientId`, but writes the admission with `resolvedReferral.patientId ?? movement.patientId`. `RAISE_REFERRAL` (line 2320) accepts an `event.patientId` that differs from the linked referral's patient.

Scenario: `RAISE_REFERRAL` with referralId RF-1 (patient A) and patientId B, while A already occupies a bed. `PULL_PATIENT` checks B, passes, then admits A. A holds two beds.

### 3. Community-team referral drops the patient link (line 2959)

`REFER_TO_COMMUNITY_TEAM` builds the new referral with `patientId: linkedReferral?.patientId` and ignores `movement.patientId`. For a walk-in with no front-door referral, the community team receives an anonymous referral.

### 4. Withdrawing a referral misses notices (line 3744)

`WITHDRAW_REFERRAL` cancels a live transport job without telling the transport officer. Its pre-acceptance branch (line 3782) withdraws every live ward request without a `ward_request_withdrawn` notice. The comment in `RECORD_ED_OUTCOME` (line 2629) says this event raises three notices; it raises at most one.

### 5. Automatic release after a revoked examination leaves wards listed as referred (line 3265)

`RECORD_EXAMINATION`'s automatic-release closure leaves `referredUnitIds` and `acceptedUnitId` set and writes no `withdrawnReferrals`. Every comparable closure (`RECORD_ED_OUTCOME`, `REFER_TO_COMMUNITY_TEAM`, `WITHDRAW_REFERRAL`) clears both. Readers that do not filter on closure, such as `missingClearances` and `overdueArrivals` in `ward-notification-center.tsx`, keep showing the movement as inbound. At `accepted_awaiting_bed` with no bed pulled, the ward notice says the bed was released when no bed was held.

### 6. Override recorded against wards that needed no override (line 3472)

`REFER_TO_UNITS` records an override against every permitted ward whenever a reason is supplied, including wards that passed every check. It also appends an override with `unitIds: []` when nothing new was referred. `ACCEPT_IN_PRINCIPLE` and `referralAcceptanceRefusal` avoid both kinds of false record.

### 7. Stale waitlist entries (line 3601)

`waitlistedUnitIds` is only cleared by a pull. `ACCEPT_IN_PRINCIPLE`, a real `DECLINE` and `WITHDRAW_WARD_REQUEST` leave a ward on the waitlist after it no longer holds a live request. This inflates the referral drawer's waiting count. Stale entries also count toward the waitlist cap at line 4395, so a genuine waitlist can be refused as "already waitlisted at 3 wards".

### 8. Re-pull keeps the old hold expiry (line 3960)

`PULL_PATIENT`'s restore path, used after a step back from `pulled`, keeps the old `pullExpiresAt`. Pull at t0 with the hold running to t0+240, step back at t0+200 and pull again at t0+250: the restored hold has already expired.

### 9. Examination outcome not checked at runtime (line 3155)

`RECORD_EXAMINATION` never checks `event.outcome` against the allowed values. Anything other than `inpatient_order` or `further_examination_ordered` is handled as a revocation. An off-list value at stage `pulled` releases the bed, deletes the admission, cancels transport and closes the movement as `did_not_proceed`.

### 10. ED outcome not checked at runtime (line 2573)

`RECORD_ED_OUTCOME` never checks `event.outcome`. The legal-form gate only fires on exactly `for_discharge`. An off-list value such as `discharge` skips the conclusive-examination gate and closes the movement.

### 11. Duplicate ward ids accepted in a referral (line 3317)

`newUnitIds` removes wards already live but not duplicates within `event.unitIds`. `['U1', 'U1']` passes the cap as 2, and duplicates U1 in `referredUnitIds` and in the override and gender-placement records.

### 12. Expected discharge editable across wards without a ward id (line 1992)

`UPDATE_EXPECTED_DISCHARGE` skips the unit-scope check when a ward-role event omits `actingUnitId`. `CANCEL_TRANSPORT` and `PATIENT_ARRIVED` refuse a ward event with no `actingUnitId`.

### 13. Referral fields not checked at runtime (line 2343)

`RAISE_REFERRAL` writes `sex`, `cohort`, `security`, `urgency` and `legalStatus` with no runtime check against their lists, whereas `RECEIVE_REFERRAL` checks sex and age band. Lower-case `female`, for example, makes `mixSexOf` return undefined, so arrival and departure never update `sexMix`.

### 14. ED medical bed release threshold contradicts its source (`ward-model.ts:534`)

`ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS` is 24, but its own comment (owner ruling FD-19) and the provenance test's header give the owner's figure as 48 hours. The test only checks the constant against itself. `docs/ward-flow/journey/MAP-INVENTORY.md:104` already records this mismatch, and the function that uses the constant has no callers.

## Conventions check (slice 1)

No breaches were found of the repository's rules on Act section citations (D5), computed legal time limits, event registration or typed text in storage. All 68 event types handled in the slice have an `EVENT_ROLE` entry, a persistence classification and a permissions-test entry.

Close calls not counted as breaches:

- Line 2046 puts the typed UMRN into an `ADD_PATIENT` collision refusal message. Refusals are never saved (D-18).
- The `legalClock` comment at `ward-model.ts:1659–1663` says the clock is computed from an entered start. That arithmetic has been removed, so the comment is out of date.
- Finding 14 above.

## Slice 2 findings

Reviewed the same way as slice 1: one reviewer, one pass, no verification pass, no test reproduction. Line numbers refer to `src/components/ward-management/ward-flow-reducer.ts` at `e7b7f32` unless another file is named. Findings S2-4 and S2-7 repeat slice-1 findings 4 and 5 (missing notices, wards left listed as referred), and S2-8 repeats the runtime-check gap of slice-1 findings 9–13.

### S2-1. Seeded journeys that are stopped or diverted can never release their bed (line 8120) — most serious

`RELEASE_DIVERTED_BED` and `RELEASE_HELD_BED` (line 8006) refuse any movement with no `admissionId`. Seeded `moving` movements (WF-006, WF-014, WF-031 and every generated `moving` record) hold a bed with no `admissionId`, a case `releasePulledBedAndAdmission`'s stage rule covers explicitly.

Scenario: seeded WF-006 (stage `moving`, `collectedAt` set, no `admissionId`) is diverted with `RECORD_DIVERSION`. `RELEASE_DIVERTED_BED` refuses ("holds no bed"), `PATIENT_ARRIVED` refuses (diverted) and `STOP_TRANSPORT` refuses (diverted). The movement stays open, awaiting release, and its bed is never refunded. After `STOP_TRANSPORT` the same movement is closed awaiting release, `RELEASE_HELD_BED` refuses, and rgh-adult-secure permanently loses one allocatable bed.

### S2-2. Revoked-examination transport hold can be cleared through the blocker text (line 4675)

The hold is keyed partly on the free-text `movement.blocker`, which `RECORD_MOVEMENT_BLOCKER` and `CLEAR_MOVEMENT_BLOCKER` can overwrite. `PATIENT_COLLECTED` also skips the `awaitingRelease` half of the check that `TRANSPORT_ACCEPTED` and `TRANSPORT_EN_ROUTE` apply (lines 4552 and 4602).

Scenario: seeded WF-005 (handover ready, transport accepted, no `admissionId`) gets a revoked examination, so `TRANSPORT_EN_ROUTE` is refused. A coordinator then clears the blocker, which is accepted, and both `TRANSPORT_EN_ROUTE` and `PATIENT_COLLECTED` succeed. A patient whose examination was revoked is collected and taken to the ward.

### S2-3. Arrival into a full ward creates a phantom free bed later (line 4861)

`PATIENT_ARRIVED` accepts an arrival into a ward with no empty beds but clamps the empty count at 0, while `departAdmission` always adds one back. A ward of 20 beds with 20 occupants takes a 21st arrival (empty stays 0); after one departure it shows one ready bed while 20 people still occupy 20 beds, and a coordinator can pull another patient into it.

### S2-4. Referrer withdrawal cascade skips notices and leaves wards referred (line 7135)

`RECORD_REFERRER_WITHDRAWAL` closes linked open movements and cancels live transport without notifying the transport officer or the accepting or referred wards. It also leaves `acceptedUnitId` and `referredUnitIds` set and writes no `withdrawnReferrals`, unlike `WITHDRAW_REFERRAL` and `CANCEL_TRANSPORT`.

### S2-5. Arrival details accepted on closed movements (line 8379)

`SET_ARRIVAL_DETAILS` has no closure guard, although `EVALUATE_ARRIVAL_LATENESS` has one. On a movement closed as did not proceed, an estimate more than 60 minutes in the past raises "arrival late" notices for a patient who is not coming. On any open pulled movement the call clears `pullExpiresAt`, so an expired hold is never flagged. A `NaN` estimate is stored as-is.

### S2-6. Repatriation can be recorded from a stay that is not occupied (line 8967)

`RECORD_REPATRIATION` never checks the admission's state. From a departed, pulled or waitlisted stay it creates a return movement that can be referred, accepted, pulled and transported, but `PATIENT_ARRIVED` always refuses it ("Repatriation arrival needs the patient's occupied source stay"). The patient is stranded in transit with a bed held at the destination. This is the same end state as slice-1 finding 1.

### S2-7. Release-and-reopen from accepted-awaiting-bed misreports a bed release (line 8810)

From `accepted_awaiting_bed` with no bed held, `RELEASE_AND_REOPEN_SEARCH` still records a `pull_released` unwind and tells the ED "Bed released". It never notifies the ward whose acceptance it erases (`WITHDRAW_ACCEPTANCE` does), and it addresses the notice with `event.actingUnitId`, which is undefined for a coordinator.

### S2-8. Step-back target not checked at runtime (line 8183)

`STEP_BACK_STAGE` never checks `event.to` against `MOVEMENT_STAGES`. An off-list value gives index -1, passes the "strictly earlier" test and is written as the stage. Every later `stageCopy[movement.stage].label` lookup then throws, so dispatches for that movement crash instead of refusing.

### S2-9. Security gate means different things on the two eligibility paths (`ward-eligibility.ts:601`)

The referral path's `security` gate tests capacity (a free locked bed), while `eligibility()` tests only whether the ward has locked beds. The comments say both paths ask the same question. Because `security` is a suitability gate, an override reason gets past a capacity fact on the referral path: a mixed ward with all 4 locked beds occupied passes on the movement path, fails on the referral path, and passes there once any override reason is given.

### S2-10. Any ward can book transport for any movement (line 7523)

`BOOK_TRANSPORT` accepts any real ward as booker, with no link to the movement. An unrelated ward becomes the recorded booker that `CANCEL_TRANSPORT` trusts, so the ED's own booking is refused as "already booked" and the unrelated ward can later cancel it. The receiving ward can also book and cancel its own inbound transport, contrary to TR-D6 and WLQ-11.

### S2-11. Ward callers can accept or decline referrals for any ward (line 6354)

`ACCEPT_REFERRAL` and `DECLINE_REFERRAL` carry no `actingUnitId`, so a ward caller can accept, decline or waitlist on behalf of any unit. Every other ward-scoped event in this slice compares `actingUnitId` with the target unit.

### S2-12. Discharge barrier stored without a vocabulary check (line 8472)

`SET_DISCHARGE_BARRIER` stores `event.barrier` with no membership check, although `isDischargeBarrier` exists and the field is documented as chosen from `DISCHARGE_BARRIERS`, never typed. It also accepts departed or pulled stays. Because the event is classified as text-safe, free text sent by an untyped dispatch would be saved to session storage.

### S2-13. Transfer-out advances the discharge revision twice (line 4937)

`PATIENT_ARRIVED` increments the source stay's `dischargeRevisions` again after `departAdmission` has already done so. A transfer-out advances the revision by 2 where an ordinary discharge advances it by 1, so a client expecting N+1 after its own write is told its read is stale.

### S2-14. Withdraw control offered where the reducer refuses (`ward-referrals.ts:124`)

`referralWithdrawable` claims to mirror the reducer's refusals but omits `RECORD_REFERRER_WITHDRAWAL`'s refusal when a linked movement has been collected (reducer line 7123). The screen shows a withdraw button that does nothing when pressed.

### S2-15. Stand-down recorded against a role that did not act (`alerts/ward-broadcast-reducer.ts:146`)

`STAND_DOWN_BROADCAST_ALERT` records `event.stoodDownByRole ?? event.role` without checking it matches the acting role. `alerts-screen.tsx` hard-codes `stoodDownByRole: 'coordinator'`, so any role standing down an alert is recorded as the coordinator.

## Conventions check (slice 2)

No breaches of the `src/components/ward-management/CLAUDE.md` rules were found. The free-text fields in this slice are already on the typed-text list in the persistence classification.

## Verification

Each finding was replayed against the real reducer from the standard seed, using [`audit-artefacts/core-engine-review-repro.ts.txt`](audit-artefacts/core-engine-review-repro.ts.txt) (25 scenarios; each passes while its defect is present). Findings that could not practically be replayed were checked by reading the code. No finding was rejected.

| Finding | Verdict                       | Evidence                                                                                                                                                                                                                       |
| ------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1       | Reproduced                    | Repatriation booked, accepted, en route and collected; discharge of the source stay accepted; arrival then refused ("needs the patient's occupied source stay").                                                               |
| 2       | Confirmed by code             | `RAISE_REFERRAL` sets `patientId: event.patientId ?? raisedFrom?.patientId` with no check that they match; `PULL_PATIENT` checks one and admits the other.                                                                     |
| 3       | Reproduced                    | Walk-in referred to a community team: the new referral has no `patientId`.                                                                                                                                                     |
| 4       | Reproduced                    | Pre-acceptance withdrawal from two wards: no notices. Post-acceptance with booked transport: transport cancelled, only the ward told, no officer notice.                                                                       |
| 5       | Reproduced                    | Revoked examination at destination review: closed, but `referredUnitIds` still lists both wards and `withdrawnReferrals` is empty.                                                                                             |
| 6       | Reproduced                    | Override recorded against a fully eligible ward; repeating the referral appends an override with `unitIds: []`.                                                                                                                |
| 7       | Reproduced                    | Ward waitlisted (no bed), another ward accepts: the first ward stays waitlisted.                                                                                                                                               |
| 8       | Reproduced                    | Pull, step back, pull again: hold expiry unchanged (886), not restarted.                                                                                                                                                       |
| 9       | Reproduced                    | Off-list outcome `inpatient` at `pulled`: movement closed as did not proceed and the admission removed.                                                                                                                        |
| 10      | Reproduced                    | Off-list ED outcome `discharge` accepted, stored and the movement closed.                                                                                                                                                      |
| 11      | Reproduced                    | `referredUnitIds` stored as `["scgh-adult-open","scgh-adult-open"]`.                                                                                                                                                           |
| 12      | Reproduced                    | Ward-role update with no `actingUnitId` changed another ward's expected discharge date.                                                                                                                                        |
| 13      | Reproduced                    | Lower-case `female` accepted and stored.                                                                                                                                                                                       |
| 14      | Confirmed by code             | Constant is 24; its own comment cites the owner's 48.                                                                                                                                                                          |
| S2-1    | Reproduced                    | WF-006 diverted: release, arrival and stop all refused; movement stays open. WF-006 stopped: `RELEASE_HELD_BED` refused ("holds no bed").                                                                                      |
| S2-2    | Reproduced                    | WF-005: revoked examination blocks en route; clearing the blocker is accepted; en route and collection then succeed.                                                                                                           |
| S2-3    | Reproduced, needs a full ward | With the ward showing 0 empty beds, an arrival is accepted (empty stays 0, occupants 18 → 19); one departure then shows 1 empty bed. Only happens when a ward shows no empty beds at arrival, which the code allows.           |
| S2-4    | Confirmed by code             | The cascade cancels transport and closes movements with no notices and leaves `acceptedUnitId`/`referredUnitIds` set.                                                                                                          |
| S2-5    | Reproduced                    | On a movement closed as did not proceed, a past estimate raised `arrival_late_referrer` and `arrival_late_ward`.                                                                                                               |
| S2-6    | **Partly confirmed**          | A repatriation from a departed stay is recorded, referred and accepted, but `PULL_PATIENT` refuses it. So no patient is stranded in transit; it leaves an open movement that can never progress. Lower severity than reported. |
| S2-7    | Reproduced                    | From accepted-awaiting-bed: `pull_released` recorded, ED told "bed released", notice `unitId` undefined, no ward notice.                                                                                                       |
| S2-8    | Reproduced                    | Stage written as `pullled`; the next transport event throws `Cannot read properties of undefined (reading 'label')`.                                                                                                           |
| S2-9    | Confirmed by code             | `eligibility()` line 231 tests `unitHasLockedBeds`; the referral path line 601 tests `lockedBedsFree(unit) > 0`.                                                                                                               |
| S2-10   | Reproduced                    | Unrelated ward booked transport (`bookedBy` that ward); the ED's own booking then refused as already booked.                                                                                                                   |
| S2-11   | Confirmed by code             | `ACCEPT_REFERRAL` and `DECLINE_REFERRAL` carry no `actingUnitId`.                                                                                                                                                              |
| S2-12   | Reproduced                    | Free text stored as `dischargeBarrier`.                                                                                                                                                                                        |
| S2-13   | Reproduced                    | Transfer-out revision 1 → 3; ordinary leaving 1 → 2.                                                                                                                                                                           |
| S2-14   | Confirmed by code             | `referralWithdrawable` reads only the referral, so it cannot see the reducer's collected-movement refusal.                                                                                                                     |
| S2-15   | Confirmed by code             | Reducer trusts `stoodDownByRole`; `alerts-screen.tsx` dispatches both `role` and `stoodDownByRole` as `coordinator` whoever is viewing.                                                                                        |

Findings 9–13, S2-8 and S2-12 need a dispatch with a value the TypeScript types do not allow. They matter only if a screen, imported scenario or stored state can produce such a value; today they are defensive gaps rather than reachable bugs.

## Area 1 findings: who may do what

Scope: `ward-flow-events.ts` (role table), `ward-audit.ts`, `ward-flow-roles.ts`, with the reducer read where needed. One reviewer, one pass; "reproduced" means the reviewer replayed it from the seed. Paths under `src/components/ward-management/`.

- **A1-1. Any ward can accept and pull a bed for another ward** (`ward-flow-events.ts:2112`; reducer 3529, 3858). `ACCEPT_IN_PRINCIPLE` and `PULL_PATIENT` carry no `actingUnitId`. Reproduced: a ward accepts WF-002 for fsh-older-adult and pulls its bed; the audit shows no acting ward.
- **A1-2. Any ward or community caller can withdraw an ED's referral** (`:2328`). `WITHDRAW_REFERRAL` never checks the caller is the referrer, yet records "The referrer withdrew the referral". Reproduced on WF-002.
- **A1-3. Any ward can decline or waitlist for another ward** (`:2117`; reducer 4369). Reproduced: the ED is told a ward declined that never answered.
- **A1-4. Continuation form code lost from the audit** (`ward-audit.ts:486`). The audit checks against `SELECTABLE_LEGAL_FORMS`, which lacks 5B, 3C, 6B, 6C. Reproduced: a 5B continuation is audited with `formCode: null`.
- **A1-5. Legal form expiry can be shortened by ward or community, unaudited** (`:2480`). `RECORD_LEGAL_FORM_WRITTEN` writes `legalForm.dueAt` without the ordering rule, role limit or audit of `RECORD_LEGAL_FORM_EXPIRY`. Reproduced: expiry 1645 shortened to 651 by a ward.
- **A1-6. Audit rows for walk-in journeys lose the patient** (`ward-audit.ts:289`, 377). Takes the patient only from the linked referral, ignoring `Movement.patientId`. Reproduced on WF-001.
- **A1-7. A ward's own referral is recorded as from a community team** (`:2342`; `ward-screen.tsx:347`). `RECEIVE_REFERRAL` excludes `ward`, so the sending ward cannot withdraw or correct its referral and any community caller can.
- **A1-8. Any of four roles can set arrival details and cancel a bed hold** (`:2475`; reducer 8378). No scope check; `pullExpiresAt` is cleared, so the hold never expires.
- **A1-9. Non-ED roles can mark the medical workup done** (`:2478`). `RECORD_MOVEMENT_MEDICAL_CLEARANCE` (coordinator, ward, community) copies onto the referral, whose own event is ED-only. Reproduced with a community caller.
- **A1-10. Any ward can record "no transport needed"** (`:2082`; reducer 2464). The receiving ward can then confirm arrival without transport, contrary to TR-D6/WLQ-11.
- **A1-11. Legal expiry audit mislabels first entries as extensions** (`ward-audit.ts:509`, 482). Disagrees with the reducer's `written_on_form` basis.
- **A1-12. Cross-ward refusals audited as "transition", not "scope"** (reducer 4984, 5437, 5550, 5599, 5631, 5677, 5711, 5747). Scope violations cannot be found reliably in the audit register.
- **A1-13. Any role can acknowledge an alert as any ward or the coordinator desk** (`:2499`; `alerts/ward-broadcast-reducer.ts`). The acknowledgement list misstates who acknowledged.
- **A1-14. Either side can add corrections to the other side's referral** (`:2430`; reducer 7173). No `referralSenderRole` check, unlike `RECORD_REFERRER_WITHDRAWAL`.
- **A1-15. Coordinator cockpit records its decisions as "Ward manager"** (`patients/patient-transit-operations.tsx:169`, 302, 589). Hard-coded role `ward`, so override acceptances are attributed to a ward.

## Next steps

1. Reproduce the two stranded-in-transit findings (slice-1 finding 1 and S2-6) and the unreleasable seeded bed (S2-1) with failing reducer tests, then fix them.
2. Work through the remaining findings the same way, in order of severity.
3. Optionally repeat both slices with a real ultrareview from Claude Code on a PC, which checks each finding independently.
