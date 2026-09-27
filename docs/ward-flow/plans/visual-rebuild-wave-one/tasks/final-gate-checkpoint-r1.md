# Final first-wave gate checkpoint — 2026-09-13

Controller: Astra. Local, uncommitted source on `codex/task-ward-flow-live-state-20260831`, HEAD `1ef9ed3975078b789e9b5d70b3f000c64edc3809`. This records the actual remaining blocker; it does not call the integrated suite green.

## Focused correction evidence

The shared-admission wrapper delegates the explicit file list to `scripts/run-ward-tests.mjs` and releases its lease in `finally`. Only the controller executed tests.

```text
node .superpowers/sdd/2026-09-12-visual-rebuild-wave-one/run-focused.mjs tests/ward-bar-zero-is-reachable.test.ts tests/ward-chrome-owner.test.ts tests/ward-css-token-references-resolve.test.ts tests/ward-flow-seam.test.ts tests/ward-board-people-panel.dom.test.tsx tests/ward-delays-nobody-waiting.dom.test.tsx tests/ward-mutation-harness-reachable.test.ts tests/ward-nav.test.ts tests/ward-primitives-shared.test.ts tests/ward-sidebar-phone-contract.test.ts tests/ward-statistics-claims.test.ts tests/ward-table-min-width.test.ts tests/ward-table-single-source.test.ts tests/ward-printable-disclosures.dom.test.tsx tests/ward-hub-screen.dom.test.tsx tests/ward-community-hub.dom.test.tsx tests/ward-statistics-sections.dom.test.tsx tests/ward-shell-third-edition.dom.test.tsx tests/ui-v2-components.dom.test.tsx
```

Runner: **19 files handed in, 19 ran; 399 collected, 397 passed, 2 failed, one batch, exit 1**. No pending tests. JSON: `C:/Users/joshs/AppData/Local/Temp/ward-tests-2k93ct/report-0.json`. Failures were the shared Tooltip dependency declaration and mutation harness. All other files passed, including the shared Tooltip consumers and printable-disclosure regression.

```text
node .superpowers/sdd/2026-09-12-visual-rebuild-wave-one/run-focused.mjs tests/ward-flow-seam.test.ts tests/ward-mutation-harness-reachable.test.ts tests/ward-board-third-edition-headings.dom.test.tsx tests/ward-delays-screen.dom.test.tsx tests/ward-hub-screen.dom.test.tsx
```

Runner: **5 files handed in, 5 ran; 65 collected, 63 passed, 2 failed, one batch, exit 1**. JSON: `C:/Users/joshs/AppData/Local/Temp/ward-tests-5z1yKI/report-0.json`. Board, Delays and Hub passed after removing unsupported `exact` role-query options (string accessible names already match exactly). The dependency canary still pinned eight entries, and the harness still failed.

The controller initially updated only the dependency count, then the next single-file run exposed its separate exact-membership pin: **1 handed in, 1 ran, 5 collected, 4 passed, 1 failed** (`ward-tests-LnuJ5m/report-0.json`). This was an avoidable incomplete guard update, not a product regression. The final correction names only Tooltip in both pins, with the explicit portal/scroll-clipping/focus-lifecycle rationale beside the approved dependency. The hardcoded route and inward/relative import invariants remain unchanged.

```text
node .superpowers/sdd/2026-09-12-visual-rebuild-wave-one/run-focused.mjs tests/ward-flow-seam.test.ts
```

Final runner: **1 file handed in, 1 ran; 5 collected, 5 passed, 0 failed, one batch, exit 0**. JSON: `C:/Users/joshs/AppData/Local/Temp/ward-tests-fcYny3/report-0.json`.

The historical full run remains **451/451 files, 5,121 collected, 5,031 passed, 15 failed, 75 pending**. It was not repeated. Focused closure does not convert that snapshot to a full passing run.

Independent Luna accounting review, clarified against the source by the controller: all fourteen original non-harness failures have later relevant passing evidence. Three assertion names changed with the inspected design: the zero-bar guard passes 2/2 while exactly naming the remaining Capacity and Movements callers (Delays now uses four duration facts); Delays empty/populated facts pass 4/4; the sidebar contract passes 7/7 with the separate phone-interval parser controls retained. These are bounded contract replacements, not claims that the former DOM shapes remain. No pending tests occur in the focused batches. The harness is the sole original failure without executable closure.

## Typecheck

```powershell
$env:HEAVY_RUN_WAIT_TIMEOUT_MS='1000'; npm run typecheck
```

First admitted run found four unsupported role-query options in three changed tests, plus two unused suppression comments. After the four new diagnostics were fixed, one justified follow-up ran the same command. **Exit 1; only two TS2578 diagnostics remain**, at `tests/ward-ledger-stale-row-guard.test.ts:6` and `:8`.

Independent Sol source comparison confirms the test is byte-identical to HEAD (Git blob `a26912a2f1863cf216f12604b7e581a4a926f34a`), as are its imported modules and TypeScript configurations. The comments were introduced with that test in `ed57c76a72`; `allowJs: true` and direct named exports leave nothing for them to suppress. This is source-established pre-existing error evidence, not a separately executed baseline typecheck. The unrelated test was left unchanged. No remaining new type diagnostic was reported.

## Mutation harness: environment blocker and bounded protection

An earlier diagnostic established `UNKNOWN`, errno `-4094`, syscall `open`, from Windows `writeFileSync` during Guard 4 restoration. The same error affected two formatter writes; targeted retries there succeeded. The underlying OS locker or filesystem cause is not established.

`scripts/ward-flow/mutation-run.mjs` now retries only restoration of the identical captured Buffer: three total attempts, 20ms then 50ms pauses, only `UNKNOWN`/`EBUSY`/`EPERM`. The independent read-back hash remains mandatory; mismatch is never retried. Exhaustion reports possible mutant residue and exits `RESTORE_FAILED` (3). Self-test controls cover exact Buffer identity on recovery, exhaustion after three EPERM attempts, and immediate EACCES failure. Sol independently reviewed this patch with no P0–P2 finding. Mutation application and test execution are never retried.

The final diagnostic was executed once after this bounded correction:

```powershell
node .superpowers/sdd/2026-09-12-visual-rebuild-wave-one/run-mutation-diagnostic.mjs *> .superpowers/sdd/2026-09-12-visual-rebuild-wave-one/mutation-final-diagnostic.log
```

**Exit 1, `self-test: 1 RED`.** All three new restore controls passed. The remaining RED was the inverse no-tests case: the child could not open the file for its initial mutation write at `runMutation:513`, before its fake test command could supply the expected verdict. Diagnostic output also records restoration recovering after three attempts. Therefore the current failure is not evidence that the no-tests classifier is wrong; the mutation could not be applied. The blocker remains a real failed executable gate.

After the diagnostic, the script's anchor equals the committed anchor, there is no appended self-test probe, and the intended source patch remains. Final working-source fingerprints are taken after these checks. Do not rerun the harness unchanged or broaden retries to mutation/test execution merely to obtain green. Resume this gate after the filesystem-open issue is resolved, capturing pre/post bytes and child diagnostics.

## Completion boundary

Seven screens and shared shell have independent visual evidence at all required widths/themes; design/behavior deviations remain explicit. Human acceptance, physical-device checks and actual PDF output remain pending. Eleven tracked screens are outside this first wave. Integrated acceptance is **blocked**, not complete, because of the harness gate and pre-existing typecheck errors. The plan, task ledger, verification roster and source/capture fingerprints preserve this checkpoint. No commit, push, PR, merge, provider call or deployment occurred.
