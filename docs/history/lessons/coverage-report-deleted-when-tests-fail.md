---
name: coverage-report-deleted-when-tests-fail
description: "Vitest's coverage.reportOnFailure defaults to false and DELETES the coverage directory after any failing run, so a suite with red tests produces no report while looking like it ran."
metadata:
  node_type: memory
  type: reference
  originSessionId: 2d57ae3e-f800-40ce-8184-f96d852a4bbe
  modified: 2026-09-18T15:55:20.782Z
---

Measured 2026-09-18 in `ward-lead`, vitest 4.1.11. Three coverage runs over the ward suite
produced **no `coverage/` directory at all** while printing "Coverage enabled with v8" and a
completely normal summary. A single-file run wrote the report every time.

The difference was not the flags, the filter or the scale. It was **whether the tests
passed**:

- `node_modules/vitest/dist/chunks/defaults.*.js` — `reportOnFailure: false`
- `node_modules/vitest/dist/chunks/coverage.*.js` — `if (!this.options.reportOnFailure)
await this.cleanAfterRun();`

So on a run with any failing test, vitest collects the coverage, then **removes the
directory it just wrote**. The suite here has 63 failing tests out of 21,528, so every
full run cleaned up after itself. The single-file probe passed, so its report survived —
which is exactly the pattern that makes the mechanism look fine when tested small.

**How to apply:** pass `--coverage.reportOnFailure=true` whenever measuring coverage on a
suite that is not fully green, and say so when reporting the numbers. Check the artefact
exists and is newer than the run; never infer it from the command's exit status or its
printed summary.

⚠️ **AND THE DIAGNOSIS THAT CAME FIRST WAS WRONG AND CONVINCING.** I concluded the cause
was an added `--coverage.reporter=json` flag "silently disabling coverage and swallowing
the test filter", because a run carrying that flag wrote nothing and ran more files than
expected. Both halves were false: the flag was irrelevant, and the file count was simply
how many test files match `ward-`. The wrong explanation fitted every observation I had,
and I reported it to the owner before checking it against the tool's own source. One grep
of `node_modules` settled it. See [[a-correct-diagnosis-that-stops-the-inquiry]] — this is
its mirror: an INCORRECT diagnosis that stops the inquiry just as effectively, because it
also explains everything on the table.

**And a bad regeneration instruction is worse than none** — `ward-lead-84`'s words, 2026-09-19,
after we both lost runs to this: _"it converts 'I have not measured this' into 'I measured it and
it said nothing', which is the more dangerous of the two states and the one that looks like
diligence."_ A `regenerateWith` field naming `npm run test:coverage` alone was shipped beside the
answer and would have sent every later reader down the same hole; it now carries
`-- --coverage.reportOnFailure=true`.

Related: [[a-clean-result-from-measuring-nothing]], [[gate-wrappers-mask-exit-codes]],
[[a-control-must-test-the-premise-not-the-measurement]],
[[coverage-line-numbers-belong-to-one-tree]].
