# Q004 Task 3 implementation report

Implemented locally on 2026-09-13 in `D:/Worktrees/Database/ward-lead`, using the controller-approved corrected design and its source-backed referral-category amendment. This is an implementation handoff, **not acceptance evidence**. Controller execution and independent code review remain required.

## Owned changes

- Added `src/components/ward-management/ward-discharge-records.ts`: exact unique-ID discharge projection, runtime actor/scope checks, generation/revision DTOs, explicit linked/anonymous/unresolved identities, detached identity data, and guarded detail-open receipt reads.
- Added `src/components/ward-management/ward-audit.ts`: the closed session audit/review models, safe value sanitizers, explicit operation classification, resolved references, copied action-specific facts, append-only capture, and coordinator-only detached reads.
- Edited `ward-flow-events.ts`: three named protected commands and their role membership.
- Edited `ward-flow-reducer.ts`: generation and sequence initialization/reset handling; protected actions before legacy payload-bearing rejection helpers; fixed general rejection copy; shared existing departure transition; admission revision invalidation; decision metadata recorded at the original successful branches and referral target loop; single boundary capture.
- Edited `ward-flow-provider.tsx`: guarded consumer APIs and the provider-local monotonic open-request allocator. The audit collections themselves are not exposed on unrestricted context.
- Edited `ward-reanchor.ts`: only the `auditCaptureStartedAt` timestamp name was added.
- Added `tests/ward-discharge-records.test.ts`, `tests/ward-patient-discharge.test.ts`, `tests/ward-audit.test.ts`, and `tests/ward-audit-provider.dom.test.tsx`.
- Edited `tests/ward-patient-link-default-deny.test.ts`: explicitly names the two new guarded plumbing readers, with scope reasons; keeps the source scan and anti-vacuity assertions. Edited `tests/ward-reanchor.test.ts`: adds the audit model to the exact timestamp declaration scan and tests nonzero offset/reset behavior.
- `tests/ward-flow-reducer.test.ts` was inspected and snapshotted but did not need an exhaustive-contract edit. Its old transition assertions remain untouched.

All seven existing owned files were copied before the first edit to `.superpowers/sdd/2026-09-13-product-refinement/task-3-before/`, preserving their directory paths. The other screen owners' files were not edited. No commits, Git mutations, provider operations, storage changes, schema changes, or seed identity changes were made.

## Consumer signatures

The provider exposes:

```ts
worldGeneration: number;
readDischargeRecords(actor: WardRecordActor, unitId?: string): RecordRead<readonly DischargeRecord[]>;
openDischargeRecord(actor: WardRecordActor, admissionId: string): DischargeOpenHandle;
readDischargeRecord(actor: WardRecordActor, admissionId: string,
  handle: DischargeOpenHandle | null): RecordRead<DischargeRecord>;
readAuditEvents(actor: WardRecordActor): RecordRead<readonly AuditEvent[]>;
readAuditReviews(actor: WardRecordActor): RecordRead<readonly AuditReview[]>;
```

Import `WardRecordActor`, `RecordRead`, `DischargeRecord`, and `DischargeOpenHandle` from `ward-discharge-records.ts`; import `AuditEvent`, `AuditReview`, and `AuditCategory` from `ward-audit.ts`. A read returns `{ status: "allowed", value }` or exactly `{ status: "denied" }`. The open handle contains `{ generation, requestId }`; it is a request handle, not a success receipt. Until the reducer processes the request, detail reading denies.

`DischargeRecord` includes stable `discharge-${admission.id}`, `admissionId`, `unitId`, `generation`, `revision`, `identity`, `admissionState`, the existing planned-date/confirmation provenance, blocker, departure time and destination. A linked identity has only patient ID, given name, family name and UMRN. No patient's other referrals or episodes are returned.

Existing dispatch is the write API:

```ts
{ type: "RECORD_PATIENT_DISCHARGE", role: "ward", now, actingUnitId,
  admissionId, patientId, expectedGeneration, expectedRevision, leavingDestination }
{ type: "REVIEW_AUDIT_EVENT", role: "coordinator", now, eventId,
  expectedGeneration, expectedReviewCount, decision: "reviewed" | "follow-up-required" }
```

Use the selected DTO/event's generation and revision/count. Screens clear selected handles when actor, target or generation changes. Allocated request numbers continue across reducer resets; provider remount recreates the entire world, allocator and consumer subtree. Handles must not be persisted across provider instances.

## Captured outcomes and preserved behavior

The final closed category union is `referral | override | legal-status | legal-form | discharge | record-access | review`. The controller approved `referral` for ordinary `REFER_TO_UNITS` attempts after source inspection showed the existing valid override-reason branch returns before eligibility checks, making mixed results possible only without a reason. Ordinary referrals record `reason: null` and `overrideFactRecorded: false`; supplied-reason operations keep category `override`.

The existing referral loop produces ordered accepted/refused target results while it makes its original decision. Outcomes are `accepted`, `partial`, `denied`, or `stale`. There is no duplicate eligibility call and no rejection-prose parsing. Other legacy refusals retain the generic typed `transition` reason, with `role` recorded by the existing role gate; the capture does not invent a specific historical failed gate. A persisted override fact is distinguished from a supplied reason and never claims that a gate was bypassed.

Bed audits copy typed before/requested/after date, waiting-on, blocker and preparation facts; departure audits copy requested and recorded destinations. Legal values, role values, form codes and timestamps are runtime-sanitized. Untrusted new patient/role/ID/enum strings never enter general rejection fields. Malformed new command time creates audit `at: null` and omits the general rejection row. A stale-generation subject remains unresolved; its access request number cannot reserve a new-generation receipt.

Both departure commands call the same transition: increment empty within the existing physical clamp, decrement the existing sex mix within its floor, and end the admission. Allocatable is unchanged and `RELEASE_BED` is not dispatched. Anonymous bed-release lifecycle/arithmetic, derived-release functions, eligibility thresholds, guard ordering, ranking, admission schema, legal vocabulary and existing legacy rejection wording remain unchanged. Arrival and departure invalidate the projected revision; releasing a pull removes its revision entry. Away/return do not change projected fields. Counter allocation refuses exhaustion.

Review appends an administrative review plus its audit event atomically. It never changes the reviewed event or clinical records. No review of a review event is permitted. Audit reads return detached nested records. Capture starts empty; it is never synthesized from historical seed facts.

## Authored proof and execution status

The four new focused suites cover actor/scope denial; exact/anonymous/unresolved/duplicate identities; confirmed-undated projection; processed open receipts and idempotency; stale links/selections/roles/reset handles; linked and legacy departure arithmetic; arrival/legacy departure revision invalidation; malformed payloads and counter exhaustion; all-permitted/all-refused/mixed ordinary referrals; supplied-reason acceptance/pull without a persisted override fact; immutable action-specific bed facts; legal form/status sanitization; coordinator review, stale counts/generations and review-of-review denial; nested DTO mutation isolation; provider navigation/reset/scenario/remount behavior; and absence of storage/network writes.

Executed checks were deliberately limited to the brief's permitted syntax/format inspection:

- Installed TypeScript `createSourceFile` parse inspection over the 12 changed source/test files: **12 files parsed; 0 parse diagnostics**. This is syntax evidence, not typecheck or test execution.
- `node node_modules/prettier/bin/prettier.cjs --write` with the exact 12 changed source/test paths: **exit 0**, all files formatted.
- Snapshot-relative textual diff inspection of reducer/events/provider: only the described contracts, capture metadata, common departure extraction and one incidental Prettier line wrap were found.
- A read-only `node --import tsx` seed/projection inventory found **267 admissions, 2 uniquely linked patient admissions, both with planned dates, 222 projected discharge records, 2 linked projected records**. The linked examples are `AD-RPHS-14` in `rph-adult-secure` (occupied) and `AD-LEFT-01` in `arm-adult-open` (departed). No fixture was modified by that inventory.

**No test runner, typecheck, server, browser, or provider check was run by this implementer.** The controller should execute the four new suites plus the modified default-deny/reanchor guards and relevant existing reducer, bed-release, derived-release and eligibility guard tests, then review the actual runner summary and the independent source review. Browser proof belongs to the screen owners/controller.

This is a declared-role local prototype contract, not authenticated access control, durable retention or complete access capture. List DTOs already contain identity/discharge facts; the explicit access capture records selected detail-open decisions, not every disclosure or proof a person read a screen. Session resets/remounts discard audit and review history. Existing unrestricted patient/admission context was not redesigned by this task.

## First controller-run corrections

The controller's first combined focused run reported 13/13 files ran, 200 collected, 190 passed and 10 failed (`C:/Users/joshs/AppData/Local/Temp/ward-tests-dPoJdI/report-0.json`). Two failures belonged to the newly authored Task 3 tests:

- The capture-seed test incorrectly assumed the current seed included movement override entries. Its non-vacuity assertion now uses an actual seeded departed admission with a recorded departure time, preserving the test's assertion that historical captured-scope facts exist while the capture collections start empty.
- The arrival revision test incorrectly dispatched the ward role. The existing `EVENT_ROLE.PATIENT_ARRIVED` permits only officer. The test now dispatches that existing role and first asserts there were no rejections before checking occupancy and revision. No event permission or reducer guard was changed.

The third reported boundary failure identified actual `.patientId` reads in the unowned `coordinator/shortlist-panel.tsx`. The controller confirmed all five reads were byte-identical in its pre-Q004 `task-1-before` snapshot. It remains a baseline blocker; this implementation does not broaden the guard or admit the screen. The remaining seven failures belong to the controller's other screen work. No rerun was performed by this implementer; corrected tests await the controller's affected-scope rerun.

## Independent review correction

`task-3-code-review.md` identified one P2 interaction: protected role/time checks correctly precede the generation refusal, but the audit builder had used the winning `reasonCode === "generation"` to suppress subject lookup. An old command refused earlier for role or malformed time could therefore attach a newly seeded subject and discharge facts despite refusing the clinical action.

The builder now independently requires a safe, matching protected `expectedGeneration` before resolving any audit subject or state-derived departure snapshots. Role/time refusal precedence and legacy clinical behavior are unchanged. Two parameterized regressions in each of `ward-patient-discharge.test.ts` and `ward-audit.test.ts` combine reset/reused IDs with malformed time or a disallowed role, asserting unresolved subject, unchanged clinical/review state, null state-derived departure facts where applicable, and the original refusal reason. These four added cases await controller execution. Only `ward-audit.ts` changed for the source correction, and the three affected source/test files were formatted successfully.
