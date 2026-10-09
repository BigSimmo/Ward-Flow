# Faster local testing

The main saving is to test one stable, related batch once, instead of starting the
same tests for each file or each extracted reducer. Use this during development;
the selected final repository gates remain required. It does not prove browser
appearance, a hosted result or the whole repository.

Create a JSON plan outside the repository:

```json
{
  "schemaVersion": 1,
  "changedFiles": ["src/components/ward-management/ward-flow-reducer.ts"],
  "tests": [
    "tests/ward-book-transport.test.ts",
    "tests/ward-stop-transport.test.ts",
    "tests/ward-cancel-transport-stage.test.ts"
  ],
  "workers": 2,
  "timeoutMs": 180000,
  "extraInputs": []
}
```

Choose every meaningful test for the actual batch, including affected helpers and
contracts. The transport examples are not complete acceptance coverage. Review
selection when source, fixtures, dependencies or behaviour change. Ward source files declared in `changedFiles` automatically add the three existing source-reading boundary guards.
Keep that declaration complete for the actual batch. The runner deduplicates the union and runs it in one Vitest invocation. The default
`focused` mode uses the repository's authorised direct-Vitest development route,
with at most 16 exact files and two workers. It avoids readiness-wrapper/admission
overhead and retains test isolation and native owned-job supervision on normal exit and timeout.
For larger selections use `"executionMode": "guarded"`, which uses the existing
run-slot and guardian wrapper. Neither mode replaces a final required gate. It
scrubs provider credentials and removes ambient test exclusions/sharding.

```powershell
node scripts/ward-flow/test-batch.mjs --plan D:/Temp/ward-batch.json --output D:/Temp/ward-test-evidence --dry-run
node scripts/ward-flow/test-batch.mjs --plan D:/Temp/ward-batch.json --output D:/Temp/ward-test-evidence
```

Every run produces separate log, JSON test report and result files. The runner
requires a nonempty successful report containing exactly the selected files.
Failures, deadlines, launch errors and inputs changed during a run never count as
a valid pass. The deadline includes waiting for admission; it does not shorten
individual test timeouts. Unknown child termination remains an explicit failure;
in guarded mode the existing guardian retains unknown admission rather than
reclaiming peer work. Test-only markers are refused (`--allowOnly=false`); there
is no pass-with-no-tests option.

For an expensive unchanged batch, add `--reuse`. This scans actual installed
dependency bytes, the whole tracked/nonignored working tree, runtime binary,
environment and selection. It checks the inputs before and after execution, and
requires intact original evidence before reuse. CI never reuses a local result.
Full dependency hashing can cost more than a tiny test: leave reuse off for short
checks. Declare ignored fixtures or artifact inputs in `extraInputs`; do not use
reuse when any relevant input is unknown or externally mutable. Standard dotenv
inputs are hashed without recording their contents. A result says `reused` and
its original time rather than claiming a fresh execution.

Run lint/type checking once on the stable batch, where selected by repository
policy. Use the existing CodeScene hash cache to review only changed files, and
review the central facade at structural milestones. Reserve the broad unit,
browser and build checks for the required stable-candidate boundary; never replace
them with this focused result. Preserve assertions, coverage floors, snapshot
review and source ownership. No retry, live provider call, snapshot update,
coverage-threshold change or UI/source refactor is performed by this runner.
