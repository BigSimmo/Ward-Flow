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
- Slice 2: not yet reviewed.
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

## Next steps

1. Review slice 2 the same way, against its scaffold base.
2. Reproduce finding 1 with a failing reducer test, then fix it. Treat the other findings the same way, in order.
