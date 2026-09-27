# F14 mutation phase diagnostics r35

Date: 2026-09-13

## Change

Added diagnostic-only phase evidence to `scripts/ward-flow/mutation-run.mjs`:

- An initial mutant write failure now reports that application was not verified, including the error code, syscall, and message, before rethrowing. The wording deliberately does not claim that no bytes changed because an unsuccessful write can be partial.
- An exhausted restore reports whether it occurred after Guard 3 verified the mutant or before mutant application was verified, using the existing `mutantApplied` state.
- An abnormal self-test child now forwards stdout as well as stderr, retaining the existing `mutant blob … (applied)` marker in parent evidence.

The bounded retry delays and allowlist are unchanged. Restoration still writes the captured original bytes, the independent restored-content hash guard is unchanged, and exhausted restoration still exits fail-closed with status 3. Verdicts and self-test assertions are unchanged.

## Evidence

- Before snapshot: `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-mutation-phase-diagnostics-r35/mutation-run.mjs`
- Before SHA-256: `596E62D0018B56F6EE2189E126DF2C70A7D985F28C411CBFD70BCF561D55E6B0`
- After SHA-256: `E789B422C4E8E77E4F711590D81B01CD7CF986A5973397A6DF4AF4007CD01218`
- `node --check scripts/ward-flow/mutation-run.mjs` — passed.
- `git diff --check -- scripts/ward-flow/mutation-run.mjs` — passed.
- The self-test anchor remains `self-test-mutation-anchor-do-not-duplicate`.

No mutation self-test or other test was run. The controller retains the next focused run after the external lease ends.

## Limit

This patch improves the next failure's evidence. It does not diagnose the underlying Windows open refusal, prove that the 770 ms retry window is sufficient, or change recovery behavior.

## Evidence-backed application correction

The next controller run retained the full child streams in `ward-tests-MGOTxd/report-0.json`. Three abnormal children printed the pre-mutation hash and `MUTANT APPLY FAILED`, never the Guard 3 `(applied)` marker. Each subsequent restoration recovered on its fourth or fifth attempt and verified byte-identical. This proves the observed failure was the initial mutation write, not restoration after a verified mutation. It also exposed that a raw Node exit 1 from an apply failure could falsely satisfy a self-test expecting the `SURVIVED` verdict.

The harness now:

- uses the existing unchanged `UNKNOWN`/`EBUSY`/`EPERM` allowlist and 20/50/100/200/400 ms delays for the initial mutation write as well as restoration;
- still runs Guard 3 after a successful write and before any command;
- classifies an exhausted application write as `INDETERMINATE` (exit 4), then restores and hash-checks the captured original bytes;
- preserves restoration failure as the higher-priority exit 3;
- includes a deterministic injected-write self-control proving all application attempts can fail, the command is never invoked, and the resulting verdict is exit 4; and
- requires both expected-survival controls to contain the Guard 3 `(applied)` marker, so an unrelated raw exit 1 can no longer pass them.

No retry delay, retryable error, command verdict, restoration rule, or hash guard was widened or removed.

- Before application-correction snapshot: `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-mutation-apply-retry-r35/mutation-run.mjs`
- Before SHA-256: `E789B422C4E8E77E4F711590D81B01CD7CF986A5973397A6DF4AF4007CD01218`
- After SHA-256: `CF6094743E1462B09F27124150623E427F33592343A61888B1738FF0BF1A0217`
- `node --check scripts/ward-flow/mutation-run.mjs` — passed.
- `git diff --check -- scripts/ward-flow/mutation-run.mjs` — passed.

No test or mutation command was run after this correction. The controller owns the single focused verification.

## Focused verification and independent closure

The controller's focused result is retained at `C:/Users/joshs/AppData/Local/Temp/ward-tests-DKiQfU/report-0.json`:

- 1 file handed in and 1 file run;
- 2 tests collected, 2 passed, 0 failed;
- the declared-command/self-test case passed in 5,590.212 ms; and
- the harness remained exactly `CF6094743E1462B09F27124150623E427F33592343A61888B1738FF0BF1A0217` after the run.

An independent post-run source review found no material exception-precedence or fail-closed regression:

- only the exact error object raised by exhausted application retries is swallowed into the deliberate exit-4 path; unrelated exceptions still propagate after `finally` restores the captured bytes;
- restoration write failure and restored-hash mismatch both return from `finally` with exit 3, so they take priority over an application or command verdict;
- a successful restoration after exhausted application briefly assigns the legacy refusal code inside `finally`, but the final assignment restores the deliberate `INDETERMINATE` exit 4 before return;
- Guard 3 still verifies changed content before `mutantApplied` becomes true or the command can run; and
- both expected `SURVIVED` self-controls now require the verified applied marker, while the deterministic exhausted-application control proves the command callback was not reached.

This closes the focused harness regression. It does not identify the external Windows process responsible for transient file-open refusals or establish behavior under forced process termination, which remains outside `finally` by design.
