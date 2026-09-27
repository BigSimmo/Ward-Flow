# F14 mutation restore diagnostic r32

Date: 2026-09-13

## Measured failure

The declared `npm run mutate:self-test` command was run once with stdout and stderr redirected to
separate evidence files. It exited 1 with two red self-test cases. Both affected mutation children
exited with the fail-closed restore status 3 and reported:

```text
UNKNOWN open: UNKNOWN: unknown error, open
'D:\Worktrees\Database\ward-lead\scripts\ward-flow\mutation-run.mjs'
```

The failures occurred after the original restore helper exhausted three attempts with 20 ms and
50 ms waits, a total retry delay of 70 ms. The harness SHA-256 was
`599970246AA88B01EEA7FBE2F7F8E0C782A981EA67631CFB23880A4C2355D8AA` both before and after that
run, and its anchor remained correct; no residue was observed.

Evidence is retained under
`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/mutation-self-test-r32/`, including the
before copy, separate stdout/stderr, and before/after hashes.

## Bounded retry candidate and result

The existing retry helper was changed from the measured-insufficient 70 ms window to six attempts
with bounded delays of 20, 50, 100, 200, and 400 ms (770 ms total). This changed only transient
restore opens for the existing `UNKNOWN`, `EBUSY`, and `EPERM` allowlist. Every attempt still writes
the identical captured buffer; non-allowlisted errors still fail immediately; the independent
post-write hash guard remains; exhausted retries still report `RESTORE_FAILED` and exit 3.

This was a candidate improvement, not a proven lock duration or root-cause explanation. The
controller's post-change focused run still failed: 1 file, 2 cases, 1 passed and 1 failed, report
`ward-tests-xkPgqr/report-0.json`. The script remained at SHA-256
`596E62D0018B56F6EE2189E126DF2C70A7D985F28C411CBFD70BCF561D55E6B0`, with its anchor correct.
Therefore the 770 ms candidate is insufficient and the restore issue remains unresolved. No further
retry widening or unchanged rerun was performed.

## Diagnostic retention correction

`tests/ward-mutation-harness-reachable.test.ts` now captures the child stdout, stderr, combined
output, and status once. When the required `self-test: all guards fire` marker is absent, the existing
assertion message includes all three child diagnostics. The assertion still checks the same marker,
in the same order, and the subsequent exact exit-0 assertion remains unchanged. Test count and pass
criteria are unchanged.

- Before test snapshot:
  `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-mutation-test-diagnostic-r32/ward-mutation-harness-reachable.test.ts`
- Before test SHA-256: `B5C8F84CECF2D53DBBDA42DE11E4B87BD201C41BDD5757D44CE2373A6E173A23`
- After test SHA-256: `DED2D5A65FEE90975A424C55D14DBE66696392514BDB90A107301AE801270373`
- Current harness SHA-256: `596E62D0018B56F6EE2189E126DF2C70A7D985F28C411CBFD70BCF561D55E6B0`
- Prettier completed for the test file.
- `git diff --check` passed for the harness and test.

No test was run after the diagnostic-only assertion-message change, per instruction. The next
mandatory focused gate should now retain the actual child failure automatically if the summary is
again absent.
