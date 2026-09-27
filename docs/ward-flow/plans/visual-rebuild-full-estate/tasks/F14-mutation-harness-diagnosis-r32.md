# F14 mutation harness diagnosis r32

Date: 2026-09-13. Read-only diagnosis; the harness and tests were not run.

## Recorded failure

The full-gate triage records one `ward-mutation-harness-reachable.test.ts` failure: output did not contain `self-test: all guards fire` and began `ok restore retries transient IO...` (`F14-full-gate-triage-r24.md`, §Harness/environment classification). The recorded classification correctly left this as unresolved Windows/harness evidence rather than a product pass.

## Concrete current cause

The current worktree copy of `scripts/ward-flow/mutation-run.mjs` is itself left in a mutation residue state:

- `git diff -- scripts/ward-flow/mutation-run.mjs` shows the declaration changed from the committed `SELF_TEST_ANCHOR` value `self-test-mutation-anchor-do-not-duplicate` to `mutated`.
- The live file contains 11 occurrences of `mutated`; the committed HEAD blob contains one occurrence of its original anchor.
- `assertAnchorPristine()` runs before `selfTest()` and compares both the declaration and occurrence count with `git show HEAD:scripts/ward-flow/mutation-run.mjs`. With this live state it must refuse before executing the six self-test cases, so the required final summary cannot be emitted.
- The implementation's own comments describe this exact failure mode: interruption between mutation and restore leaves the anchor changed, and the next invocation reports a refusal that can look like a broken harness.

This is stronger evidence than the earlier generic Windows hypothesis: the current source state independently explains the missing summary. The original recorded run may have had a transient open refusal, but the present worktree definitely fails the anchor precondition before any Windows retry path is relevant.

## Smallest candidate recovery

The owner should first preserve the current 94-line implementation diff and repair only the self-test declaration to the exact committed anchor literal, then verify its occurrence count is one. Recheck the resulting diff before any authorized self-test. Do not restore or discard the whole file: the current diff includes the retry implementation and other harness changes that may belong to active work. If the exact declaration/count cannot be restored without resolving concurrent ownership, record the harness as blocked rather than bypassing `assertAnchorPristine()` or weakening `ward-mutation-harness-reachable.test.ts`.

No test, browser, server, provider, source, or canonical verification record was changed by this diagnosis.
