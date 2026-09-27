# FULL fold gate: checkpoints and bounded rechecks

Use this only when `select-fold-gate.mjs` selects **FULL**. Keep the normal fold lock, preflight backup, diff review, type check and selected journeys. The check below must run through the wide gate slot.

## First FULL run

Run `npm run check:ward-expected-reds` on the committed batch. It writes one validated JSON report per group of at most 100 test files and appends each group's findings to `findings.log`. The command prints its checkpoint directory and, after checking the complete population, a receipt path. A failed test still produces a receipt if every requested file reported; an incomplete run does not.

If the process crashes, run the same command on the **same commit and in the same checkout**. It validates the saved population and each completed group, then runs only missing groups. A changed commit or checkout gets a different checkpoint. An invalid saved group stops with a clear error rather than being counted as passing.

The default checkpoint directory is under the machine's temporary directory. Set `WARD_FULL_GATE_STATE_DIR` to an owned persistent directory before the first run if that directory may be cleared. Keep the directory and the printed receipt until the batch is folded. No automatic cleanup deletes this evidence.

## After a small red

Read `findings.log` and the gate's failure details. Run just the failing tests while diagnosing and correcting the issue. Commit the stable correction before using a gate verdict.

When the **only** correction is to at most eight existing test files, all original gate problem files were changed, no test population or tooling selection changed, and none of those tests exports a helper or is referenced by another collected test, set `WARD_FULL_GATE_RECHECK` to the first run's printed receipt path and run the same gate command. It reruns the changed files, combines them with the validated passing results from the first FULL run, and applies the unchanged population, floor and expected-red checks. A refused recheck exits without silently starting another full run.

A source fix, shared helper/config change, added or removed test, incomplete first report, or uncertain impact needs a new FULL run on the corrected commit. Finish focused diagnosis first so that broad run occurs once on the stable version. A passing focused test alone is never recorded as a FULL verdict.
