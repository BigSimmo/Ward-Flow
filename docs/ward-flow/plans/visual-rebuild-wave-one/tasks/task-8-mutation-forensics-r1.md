# Task 8 mutation-harness forensics — revision 1

Date: 2026-09-13  
Source baseline: `1ef9ed3975078b789e9b5d70b3f000c64edc3809`

## Finding and recovery

The dirty `scripts/ward-flow/mutation-run.mjs` was a stranded self-test mutant, not an ambiguous authored change. Its only diff changed the committed `SELF_TEST_ANCHOR` value to the harness's exact built-in replacement, `"mutated"`.

- `ward-mutation-harness-reachable.test.ts` began at `2026-09-13 01:13:34.549 +08:00` and ended at `01:13:44.384 +08:00`.
- `mutation-run.mjs` was last written at `01:13:43.229 +08:00`, inside that test interval.
- The live mutant had Git blob id `2adad50b8e5d99a0a464154004ffcbaf2d687c0f` and SHA-256 `29AFC3788949F8E561DEA64DF98B694122BB20CC379C2E7929ADF267A0252D65`.
- Replacing that one anchor in memory reproduced the committed file byte-for-byte: Git blob id `6107701d3d9812b07966de8c75400f9dea28f025`, SHA-256 `2372C064339499623C47B3B23556A0DAFCDDDB2C001228F0EE33C6C83BE80FEB`.

Root then performed only the guarded one-line anchor correction. The working file now has SHA-256 `2372C064339499623C47B3B23556A0DAFCDDDB2C001228F0EE33C6C83BE80FEB`, and `git diff --exit-code -- scripts/ward-flow/mutation-run.mjs` is empty.

## Cause and evidence limit

Normal `runMutation` completion restores captured bytes in `finally`, including when the nested command fails. The evidence therefore supports interruption after the mutant write and before restoration. The saved reports do not identify the precise child termination cause: the self-test's `invoke` helper retains only `spawnSync(...).status`, discarding `signal` and `error`, while the JSON report retains only the parent assertion failure.

`die()` still calls `process.exit()` and can be reached by the post-write Guard 3 inside the `try`, which structurally bypasses `finally`. That path does not explain this residue: Guard 3 calls it only when the post-write hash equals the original, while the persisted mutant had a different hash. No harness pass is claimed from this investigation or recovery.

## Freeze correction

`wave-source-fingerprints.json` was written at `01:13:48.492 +08:00`, after the failing self-test ended, and records the mutant SHA-256 `29AFC378...`. It is a post-failure sample, not a pre-run source freeze, and must be superseded after recovery.

No test, harness, browser or server command was run during this read-only diagnosis. This report is the only file written by the forensic task.
