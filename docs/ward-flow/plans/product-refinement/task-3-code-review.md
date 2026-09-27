# Q004 Task 3 — independent domain code review

Reviewed 2026-09-13 against the corrected `task-3-design.md`, including its ordinary-referral category amendment, the design review and implementation brief. Existing owned source and tests were compared with `.superpowers/sdd/2026-09-13-product-refinement/task-3-before/`; the two new modules and four new tests were read directly. `task-3-report.md` was not present when inspected.

**Verdict: one required correction (P2).** This is source-inspection evidence, not an executed test or browser receipt. No tests, servers, Git or provider operations were run. Only this review document was written.

## R1 — P2: early refusals can attach an old-generation command to a newly seeded subject

**Source:** `src/components/ward-management/ward-audit.ts:287` and `:388–400`; the earlier refusal paths are `ward-flow-reducer.ts:1117–1119`.

Audit capture suppresses subject resolution and discharge snapshots only when the _winning reason code_ is `generation`. The protected reducer intentionally checks role and time first. Consequently, an old-generation command with an invalid time or disallowed role is refused with `invalid-payload` or `role`, and the audit builder resolves its old admission/event ID against the current generation. This breaches the explicit contract that old commands must not attach newly seeded subjects or discharge facts, even though the clinical mutation itself is correctly refused.

**Concrete source-traced reproduction (not executed):** retain a valid `RECORD_PATIENT_DISCHARGE` command selected from generation 0; reset to generation 1 so the same admission ID exists again; dispatch the retained command with `now: NaN`. The reducer returns the `invalid-payload` refusal before comparing generations. The new audit event has `at: null`, but its subject includes generation 1's admission/unit/patient references and its departure details include that admission's current state/destination. The same issue occurs with a disallowed role. For review, capture `audit-1`, retain its generation-0 review command, reset, recreate `audit-1`, then submit the old command with `now: NaN`: the denial names the replacement audit event as its subject.

**Smallest correction:** retain existing role/time decision precedence, but independently gate protected audit subject resolution and state-derived snapshots on a valid, matching `expectedGeneration`. A generation that is invalid or does not match must produce an unresolved subject and no state-derived discharge facts regardless of which refusal reason won. Do not reorder clinical guards or change legacy event behavior.

**Missing meaningful coverage:** extend the existing reset/reused-ID tests in `tests/ward-patient-discharge.test.ts` and `tests/ward-audit.test.ts` with stale generation combined with malformed time and wrong role. Assert unresolved subject, null discharge before/after/recorded destination where applicable, unchanged clinical state/review collection, and preserved role/invalid-payload refusal semantics. The current tests cover stale generation and malformed input separately, which misses this interaction.

## Reviewed behavior with no further actionable finding

- The shared departure helper preserves the snapshot's empty-bed/sex-mix arithmetic and leaves allocatable capacity and anonymous releases unchanged. Linked departures add unique subject/link, role/scope, generation/revision, destination and state guards; arrival/departure invalidate revisions and release-pull removes its revision entry.
- Discharge reads use exact unique IDs and narrow role scope, expose detached identity projections, omit ambiguous subjects and retain confirmed-undated records. Detail receipts bind request, generation, actor and admission, recheck current linkage, and retain the first decision for reused request IDs.
- Referral target outcomes are captured in the existing eligibility loop without rerunning gates. The ordinary-referral amendment is implemented, mixed outcomes remain visible, and supplied reasons are distinguished from an actual recorded override fact.
- New protected general refusals are fixed text. Audit details sanitize time and enum inputs, copy closed operational facts, and detach nested returned data. Reviews append separately with generation/count checks and cannot review review events or change clinical state.
- Reset/scenario generation handling, monotonic provider request allocation and capture-start reanchoring are implemented. Focused tests are authored for these paths and nested DTO detachment, but this review does not certify their execution or broader suite compatibility.

No additional source changes or scope expansion are requested. After R1, the controller should run its scheduled focused verification and inspect the resulting correction.

## R1 resolution assessment — 2026-09-13

**Resolved by source inspection; execution receipt remains controller-owned.** The correction in `ward-audit.ts:287–295` computes `mayResolveSubject` independently of the winning refusal reason. All three protected commands now require a valid, current `expectedGeneration` before resolving a subject. The departure snapshot at `:395–407` uses the same gate, so stale or invalid-generation commands cannot copy replacement admission state or destination. The legacy action path retains its prior resolution behavior, and this correction does not change role/time refusal precedence.

The new table-driven cases in `tests/ward-patient-discharge.test.ts:28–44` and `tests/ward-audit.test.ts:37–58` exercise both stale-plus-NaN-time and stale-plus-wrong-role after reset. They assert the original refusal reason, unresolved subjects, null departure state facts, unchanged clinical/review collections and null malformed-time capture. The review case explicitly recreates the same audit event ID before replaying the retained command. These are meaningful regressions for the reported interaction, rather than separate tests of its ingredients.

No residual issue identified within this bounded correction. No tests were run by this reviewer; the controller's affected run was in progress at assessment time. The original finding above remains as review history and is no longer an outstanding source blocker.
