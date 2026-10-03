#!/usr/bin/env node
/**
 * Run a set of Vitest files and REFUSE to report success unless every file handed in actually ran.
 *
 * Written 2026-08-30 for Ward Flow process-audit finding P1-05, after the failure below was
 * reproduced by accident rather than found by looking:
 *
 *   84 test files were handed to `vitest run`. A worker died with `VirtualAlloc failed`. Vitest
 *   printed `Test Files  83 passed (83)` and `Tests  1234 passed (1234)`, and EXITED 0.
 *
 * Read that pass line closely: `83 passed (83)`. THE COUNT AGREES WITH ITSELF AND NOT WITH ITS
 * INPUT. There is no red anywhere, no failing assertion, and no non-zero exit — the only evidence
 * is a number the reader has to compare against something the output does not contain. Every other
 * false-green in this project's history needed somebody to make a mistake. This one needs only the
 * machine to be busy, which is why it is the worst of the family and why it gets a wrapper.
 *
 * What this refuses:
 *   - a file handed in that produced no result   (the failure above)
 *   - zero collected tests                       (a selector that matches nothing, reported green)
 *   - a file that ran but contains no test       (an empty suite passing vacuously)
 *   - a non-zero exit from vitest itself
 *
 * It always prints BOTH numbers — handed in, and ran — because a single number cannot be checked.
 *
 * The files handed in run across one or more `vitest` invocations, batched to stay under Windows'
 * command-line length cap (see "BATCHING, 2026-09-11" below) — but the reconciliation above is
 * always against the ONE original handed-in list, never per batch.
 *
 * Usage:
 *   node scripts/run-ward-tests.mjs                       # every tests/ward-*.test.ts(x)
 *   node scripts/run-ward-tests.mjs tests/ward-clock.test.ts tests/ward-nav.test.ts
 *
 * Exit codes: 0 all handed-in files ran and passed · 1 a real test failure · 2 a coverage
 * discrepancy (files vanished, nothing collected) — deliberately distinct, because "your tests are
 * broken" and "your test RUN is not telling you the truth" need different responses.
 *
 * CURRENT CONTRACT: one outer exclusive repository lease owns this collector and every pinned
 * local Vitest child. The guardian keeps admission alive and verifies descendant completion.
 * Busy admission is a blocked run; no npx download or installation fallback is used.
 *
 * HISTORICAL LIMITATION, 2026-08-30 (resolved by the current contract):
 *
 * It spawns `npx vitest` directly. `npm run test` goes through `scripts/run-vitest.mjs`, which calls
 * `acquireHeavyRunLock` first; the coordinator permits at most two focused Vitest leases across all
 * worktrees and treats a full run as exclusive. So several sessions running the whole ward suite
 * through this wrapper bypass that limit entirely — and the limit is real: probed at 13:34 the
 * coordinator refused a run outright because a live Codex worktree held capacity.
 *
 * That is a CANDIDATE cause of the `VirtualAlloc failed` worker death this tool exists to catch —
 * memory exhaustion from concurrent unthrottled runs. Stated as a hypothesis and not a measurement,
 * because nobody correlated the death with what other sessions were doing at that second and nobody
 * can now. A correct-sounding cause that ends the inquiry is its own failure mode.
 *
 * ⚠️ AND A LIMIT THAT SITS UPSTREAM OF THIS TOOL ENTIRELY, 2026-08-30. This guarantees that every
 * file you handed in produced a result. IT CANNOT GUARANTEE THAT THE EDIT YOU MEANT TO TEST WAS
 * EVER WRITTEN TO DISK. Under commit-charge exhaustion this machine failed to fork: a `python` and
 * a `git commit` both died with `0xC000012D` (STATUS_COMMITMENT_LIMIT), and an edit was silently
 * lost — the command printed an error, the file simply did not change, and the next step carried on
 * as though it had. Later, PowerShell itself could not start.
 *
 * That failure is invisible in the way that matters: AN UNWRITTEN EDIT FOLLOWED BY A CLEAN
 * `git status` IS INDISTINGUISHABLE FROM HAVING NOTHING TO COMMIT, and a run over the old content
 * is honestly green. Every number this tool prints would be correct and the result would still be
 * about code you did not write.
 *
 * SO: after a heavy or long step, VERIFY THE EDIT LANDED before trusting any run over it. ⚠️ AND
 * VERIFY IT IN `HEAD`, NOT IN THE WORKING TREE — this correction is from Ward Board and it inverts
 * the weaker rule that stood here first. A working-tree check passes in the WORST case: the edit
 * landed, the COMMIT died, the files on disk look perfect, and `HEAD` does not have them. So:
 * `git show HEAD:<path> | grep <the thing you added>`, never `grep <path>`.
 *
 * ⚠️ AND DO NOT REACH FOR `git commit --amend` WHEN A COMMIT SEEMS TO HAVE GONE WRONG. It is the one
 * common git operation that DESTROYS the previous state as a precondition of creating the new one,
 * so under a machine that is failing to fork it can leave a branch that has simply lost a commit
 * with no error anywhere. A follow-up commit costs one line of history and cannot do that.
 *
 * ⚠️ AND WRITE INSPECTION SEQUENCES WITH `;`, NOT `&&`. A `grep -c` that correctly finds ZERO
 * matches exits 1, so an `&&` chain aborts there and every later check silently never runs — while
 * the output still reads as a finished report. THAT IS THE SAME SHAPE AS `83 passed (83)` WHEN 84
 * WENT IN: a truthful-looking result whose missing half is invisible. Two sessions hit it within an
 * hour on 2026-08-30 and the first treated it as a nuisance rather than as the finding it is.
 *
 * Same discipline throughout as reading a mutation back from disk instead of assuming it applied.
 *
 * MITIGATION THAT COSTS NOTHING: hand in only the files your change touches. The guarantee here is
 * COMPLETENESS OF WHAT YOU HANDED IN, not breadth — a narrow run is the same check over a smaller
 * set, not a weaker one. Keep the full suite for a fold, and say so when you run it.
 *
 * WHY THIS IS NOT SIMPLY FIXED BY CALLING `run-vitest.mjs`: a capacity refusal is NOT a test
 * failure. The coordinator throws when full, and the repository's own convention treats "blocked,
 * retry" as a distinct outcome from "red" (see `verify:ui`'s exit 75 /
 * DATABASE_HEAVY_RUN_ADMISSION_BUSY). Routing through the lease therefore needs a fourth outcome
 * here, not a changed spawn line — and adding that to a tool several sessions depend on, while they
 * are mid-build, is the wrong moment. Recorded for a quiet one.
 *
 * ⚠️ BATCHING, 2026-09-11. The whole ward suite grew past what fits on one command line: this tool
 * builds ONE `npx vitest run <every file> --reporter=json --outputFile=...` string and runs it
 * through `cmd.exe` (see the shell:true note below), which caps a command line at 8191 characters.
 * At 364 files that string was over 15,000 characters and vitest never started — `spawnSync` came
 * back with "The command line is too long", no report was written, and the tool correctly refused
 * (exit 2) but could not run the suite at all. The fix batches `handedIn` into several command
 * lines, sized against the ACTUAL joined length of that batch's own file paths (never a guessed
 * file-per-batch count — path lengths vary, and a fixed count silently breaks the day a long path
 * is added), each kept well under the 8191 cap.
 *
 * THE RULE THAT MAKES BATCHING SAFE, AND THE ONE A FUTURE "SIMPLIFICATION" WILL WANT TO DROP:
 * a missing report from one batch means NONE of that batch's files ran — never "skip that batch"
 * and never a per-batch pass/fail verdict. Each batch gets its own report file; if a batch's file
 * never appears (crash before write, worker death, anything), none of its results are merged into
 * the `ran` set, so every one of its files falls out of reconciliation as unaccounted for. The
 * ONLY reconciliation that counts is the original one: the full `handedIn` list, checked once at
 * the end, against the union of every batch's actual results. Reconciling per-batch instead — "did
 * this batch's own files all show up in this batch's own report" — would let one whole lost batch
 * read green as long as the batches around it were fine. That is a WORSE version of the exact P1-05
 * bug this file exists to catch: not one dropped file inside a passing run, but an entire dropped
 * batch inside a passing tool. Do not "simplify" this back to a per-batch check. A non-zero exit
 * from any batch is likewise carried through to the final verdict rather than allowed to be
 * overwritten by a later batch's clean exit — the totals and the exit code are always sums/worsts
 * across every batch, never the last batch's numbers standing in for the whole run.
 */

import { spawnSync } from "node:child_process";
import { acquireHeavyRunLock } from "./test-run-lock.mjs";
import { runOwnedChild } from "./owned-child.mjs";
import { isOfflineUnitTestFile } from "./unit-test-population.mjs";
import { offlineTestEnvironment } from "./test-environment.mjs";
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const EXIT_OK = 0;
const EXIT_TEST_FAILURE = 1;
const EXIT_COVERAGE_DISCREPANCY = 2;

const base = (p) => p.split(/[\\/]/).pop();

/** Discover from disk rather than from a hand-written list: a named set silently omits new files. */
function discoverWardTests() {
  const dir = "tests";
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith("ward-") && isOfflineUnitTestFile(`tests/${f}`))
    .sort()
    .map((f) => `tests/${f}`);
}

/**
 * The ward files this tool DELIBERATELY does not run. Printed every run, never silently omitted.
 *
 * ⚠️ A CONTROL'S COVERAGE IS PART OF WHAT IT CLAIMS (Ward Settings, 2026-08-30, after a citation
 * checker reported `documents scanned: 31` over a ~130-document corpus — a whole guarantee about a
 * set nobody had stated). `files handed in: 84` reads as "the ward suite" unless the boundary is
 * said out loud, and this tool exists precisely because a number that agrees with itself is not a
 * number anybody checked.
 *
 * Here the exclusion is CORRECT and still has to be stated: `tests/ui-ward-*.spec.ts` are Playwright
 * journeys and vitest cannot run them at all — a different runner, not a hole in this one. That is
 * the difference from the citation checker, whose missing 70 documents were genuinely in scope.
 * Measured 2026-08-30 on `claude/ward-flow-setup-967aa0-wf`: 84 discovered here, 6 excluded.
 *
 * ⚠️ DO NOT WIDEN EITHER PATTERN TO A BARE `ward` MATCH.
 * `tests/forward-codify-retrieval-targets.test.ts` contains "ward" inside "forward" and has nothing
 * to do with this project — it turned up in my own measurement of this very gap, so the trap is not
 * hypothetical. A substring match on a common English fragment is a measurement error waiting for
 * the right filename.
 */
function discoverExcludedWardSpecs() {
  const dir = "tests";
  if (!existsSync(dir)) return [];
  return (
    readdirSync(dir)
      // Both dots are ESCAPED deliberately. Unescaped, `.spec.tsx?` reads as "any char, then spec,
      // then any char, then ts" — over-permissive, in a file whose own comment above warns against
      // exactly this class of imprecision. It matched nothing wrong today (only six files in tests/
      // begin with `ui-ward-`) and the value is printed rather than used to filter the run, so this
      // is correctness, not a bug fix. Found by Ward Verifier's escaped-dot sweep, 2026-09-02.
      .filter((f) => /^ui-ward-.*\.spec\.tsx?$/.test(f))
      .sort()
      .map((f) => `tests/${f}`)
  );
}

// Windows caps a `cmd.exe` command line at 8191 characters (`CreateProcess`'s `lpCommandLine`
// limit), which `shell: true` runs through on this platform. 1200 characters of headroom below
// that is deliberately generous: it comfortably covers `npx vitest run `, ` --reporter=json`, the
// `--outputFile="..."` path, and cmd.exe's own quoting overhead, without needing to reason exactly
// about any one of them. See "BATCHING, 2026-09-11" in the file header for why this exists.
const WINDOWS_CMD_LINE_LIMIT = 8191;
const COMMAND_LENGTH_SAFETY_MARGIN = 1200;
const MAX_COMMAND_LENGTH = WINDOWS_CMD_LINE_LIMIT - COMMAND_LENGTH_SAFETY_MARGIN;

function buildVitestCommand(files, reportPath) {
  return `npx vitest run ${files.join(" ")} --reporter=json --outputFile="${reportPath}"`;
}

/**
 * Split `files` into the fewest batches whose ACTUAL joined command length (not a guessed
 * file-per-batch count — path lengths vary) stays under MAX_COMMAND_LENGTH. `reportPathForSizing`
 * only has to be representative: the real per-batch report filename differs by a digit or two,
 * which the safety margin above swallows without effect on where a batch boundary falls.
 */
function batchFiles(files, reportPathForSizing) {
  const batches = [];
  let current = [];
  for (const file of files) {
    const trial = [...current, file];
    if (current.length > 0 && buildVitestCommand(trial, reportPathForSizing).length > MAX_COMMAND_LENGTH) {
      batches.push(current);
      current = [file];
    } else {
      current = trial;
    }
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/**
 * WF-34 — this tool refuses a dropped file, a zero-exit-but-red run, and an empty suite, and said
 * nothing about a suite where every case ran but every one was skipped. `ward-ed-home.dom.test.tsx`
 * is a real, committed `describe.skip` file (12 cases, all reported `status: "skipped"` by
 * vitest's own JSON reporter) — handed to this tool alongside ordinary files, the old summary read
 * `all N handed-in file(s) ran, M test(s) passed` with no way to see that one of those files
 * contributed zero live assertions. That is not the P1-05 failure this tool already guards (a file
 * producing NO result) — it is the opposite shape: a result exists, and every case in it is inert.
 *
 * Pure — takes vitest's own `testResults` array (from the `--reporter=json` report, the same shape
 * `allResults` below accumulates) and returns:
 *   - `skippedOrTodo`: the count of assertions across every file whose status is neither
 *     `"passed"` nor `"failed"` (vitest reports `"skipped"`, `"todo"`, or `"pending"` for these;
 *     counted by exclusion so a status this tool has not seen yet is still caught, not silently
 *     ignored);
 *   - `whollySkippedFiles`: the basenames (via the same `base()` this tool reconciles with) of
 *     every file where EVERY assertion falls into that set — a file with a partial mix of passed
 *     and skipped cases is not wholly skipped, and is not reported here.
 *
 * A file with ZERO assertions is deliberately excluded from `whollySkippedFiles`: that is the
 * pre-existing `empty` / EXIT_COVERAGE_DISCREPANCY refusal below (a broken or misconfigured file
 * that collected no tests at all), a different failure from "ran and every case was skipped", and
 * folding the two together would hide a broken file inside an otherwise-benign skip count.
 */
export function summariseSkips(testResults) {
  let skippedOrTodo = 0;
  const whollySkippedFiles = [];
  for (const file of testResults ?? []) {
    const assertions = file.assertionResults ?? [];
    if (assertions.length === 0) continue;
    let fileSkipped = 0;
    for (const assertion of assertions) {
      if (assertion.status !== "passed" && assertion.status !== "failed") {
        skippedOrTodo++;
        fileSkipped++;
      }
    }
    if (fileSkipped === assertions.length) whollySkippedFiles.push(base(file.name));
  }
  return { skippedOrTodo, whollySkippedFiles };
}

function main() {
  const usedDiscovery = process.argv.slice(2).length === 0;
  const handedIn = usedDiscovery ? discoverWardTests() : process.argv.slice(2);

  if (handedIn.length === 0) {
    console.error("REFUSED: no test files selected. An empty selection cannot pass.");
    return EXIT_COVERAGE_DISCREPANCY;
  }

  const missing = handedIn.filter((f) => !existsSync(f));
  if (missing.length > 0) {
    console.error(`REFUSED: ${missing.length} selected file(s) do not exist:\n  ${missing.join("\n  ")}`);
    return EXIT_COVERAGE_DISCREPANCY;
  }

  // Forward slashes even on Windows: vitest parses `--outputFile=` as a value, and a backslash path
  // survives argv but not every downstream join. `shell: true` with one command string is used
  // because spawning `npx.cmd` with an argv array returned a null status here — killed, no report,
  // which this wrapper then correctly refused for the wrong reason. A wrapper whose own harness is
  // unreliable teaches people to ignore it.
  //
  // One temp DIRECTORY is shared across every batch; each batch gets its own report FILENAME inside
  // it (report-0.json, report-1.json, …). That is what makes "report missing" a trustworthy signal
  // per batch — a shared/reused path could still hold a PRIOR batch's file when a later batch dies
  // before writing, and `existsSync` would then lie about the batch that just crashed.
  const tempDir = mkdtempSync(path.join(tmpdir(), "ward-tests-"));
  const reportPathFor = (index) => path.join(tempDir, `report-${index}.json`).replace(/\\/g, "/");

  const batches = batchFiles(handedIn, reportPathFor(0));
  console.log(
    `Handed in: ${handedIn.length} file(s). Running in ${batches.length} batch(es)` +
      (batches.length > 1 ? " (Windows' command-line length cap does not fit them all on one)…" : "…"),
  );

  // State the boundary on every discovered run, not only when somebody thinks to ask.
  // See discoverExcludedWardSpecs for why these are excluded and why that is still worth printing.
  if (usedDiscovery) {
    const excluded = discoverExcludedWardSpecs();
    console.log(
      `Coverage: tests/ward-*.test.ts(x) only. ${excluded.length} Playwright ward journey(s) are NOT in` +
        ` this run — vitest cannot run them; use verify:ui. Excluded: ${excluded.join(", ") || "(none found)"}`,
    );
    // ⚠️ THE SECOND EXCLUDED CLASS, AND IT HAS NO LIST BECAUSE IT CANNOT HAVE ONE. The population
    // above is chosen by FILENAME. A guard that protects ward files without carrying `ward-` in its
    // own name is invisible here by construction — not skipped, never discovered.
    // 🔴 Measured 2026-09-12: `tests/source-control-bytes.test.ts` scans every tracked text file,
    // names `docs/ward-flow/**` offenders by path and line, and has never once run in this loop.
    // Five raw 0x08 bytes reached three committed ward documents while every lane quoted a green
    // number from here. The guard was not blind; this loop simply never asked it.
    // ⚠️ It is NOT fixed by widening the pattern — see the warning above about `forward`. It is
    // fixed by saying so, because the honest boundary is "ward-NAMED tests", not "ward coverage".
    //
    // 🔴 AND A CORRECTION TO THIS NOTE'S FIRST VERSION, WHICH SAID THE CLASS "CANNOT HAVE A LIST".
    // It cannot be found by FILENAME. It can be enumerated by CONTENT, and a lane did exactly that
    // within the hour — which is a fair rebuke of a sentence that made a limit sound like a law:
    //
    //     grep -lE "ward-management|ward-flow|ward-board" tests/*.test.ts tests/*.test.tsx \
    //       | xargs -n1 basename | grep -vE "^ward-"
    //
    // 18 files, measured 2026-09-12 over 1,440 test files of which 441 are ward-named. ⚠️ ALL 18
    // WERE GREEN when checked, so this is forward exposure and not a live debt — "18 guards are
    // invisible" reads as 18 unknown failures and the true figure was zero.
    // 🔴 Three of the 18 are route-reachability and mockup-retirement guards over ward routes, on a
    // programme whose route registers went red three times in one day. Those are the ones to watch.
    // ⚠️ The command is written here rather than run here: it reads 1,440 files and takes minutes,
    // and a runner that got slower every time somebody added a test is a runner people stop running.
    // ✅ Two chats produced the identical 18 BY DIFFERENT QUERIES, so this is corroboration rather
    // than one measurement repeated. The first version of this note said the opposite, defensively,
    // and the other chat supplied what settled it:
    //
    //     here   grep -lE "ward-management|ward-flow|ward-board"
    //     there  re.compile("ward-management|ward-flow|wardMovements|WardFlow", re.I)
    //
    // ⚠️ NEITHER IS A SUPERSET OF THE OTHER, and that asymmetry is the part to record rather than
    // the agreement: theirs adds the IDENTIFIER forms — a file importing the provider or fixture
    // without ever writing a hyphenated path — and is case-insensitive; ours alone carries
    // `ward-board`.
    // 🔴 So the match means no file in this class TODAY references only `ward-board`, and none
    // references only an identifier form. It does NOT mean the two queries are equivalent, and a
    // later file could be found by one and missed by the other.
    console.log(
      "Coverage: this is every ward-NAMED test, which is not the same as every test that guards ward" +
        " files. Repo-wide guards (e.g. tests/source-control-bytes.test.ts) are outside this" +
        " population by filename and run only in the full suite.",
    );
  }

  // Per-batch bookkeeping. A batch whose report never appears (or fails to parse) contributes
  // NOTHING to `allResults` — never a partial credit, never a skip. Its files simply never show up
  // in `ran` below, so the single reconciliation at the end (against the FULL handed-in list, exactly
  // as before batching existed) reports them as unaccounted for. See "BATCHING, 2026-09-11" above.
  const allResults = [];
  const batchOutcomes = [];
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  batches.forEach((batchFileList, index) => {
    const reportPath = reportPathFor(index);
    if (batches.length > 1) {
      console.log(`\nBatch ${index + 1}/${batches.length}: ${batchFileList.length} file(s)…`);
    }

    const run = spawnSync(
      process.execPath,
      [
        path.resolve("node_modules/vitest/vitest.mjs"),
        "run",
        ...batchFileList,
        "--reporter=json",
        `--outputFile=${reportPath}`,
      ],
      {
        stdio: ["ignore", "inherit", "inherit"],
        env: offlineTestEnvironment(process.env),
      },
    );

    if (!existsSync(reportPath)) {
      console.error(
        `\nBatch ${index + 1}/${batches.length} REFUSED: vitest exited ${run.status} and wrote no report.\n` +
          `No report means no evidence about what ran — this batch's ${batchFileList.length} file(s) count as` +
          " NOT RUN, not as skipped. Continuing with the remaining batches so the full picture is known;" +
          " the final tally below still refuses.",
      );
      batchOutcomes.push({ index, status: run.status, reportPath, lost: true });
      return;
    }

    let batchReport;
    try {
      batchReport = JSON.parse(readFileSync(reportPath, "utf8"));
    } catch (error) {
      console.error(
        `\nBatch ${index + 1}/${batches.length} REFUSED: could not parse its vitest report (${error.message}).` +
          " Its files count as NOT RUN.",
      );
      batchOutcomes.push({ index, status: run.status, reportPath, lost: true });
      return;
    }

    batchOutcomes.push({ index, status: run.status, reportPath, lost: false });
    allResults.push(...(batchReport.testResults ?? []));
    totalTests += batchReport.numTotalTests ?? 0;
    totalPassed += batchReport.numPassedTests ?? 0;
    totalFailed += batchReport.numFailedTests ?? 0;
  });

  const ran = new Set(allResults.map((r) => base(r.name)));

  // The dropped-file check below is the whole point of this wrapper, and a check nobody has watched
  // fail is a check nobody should trust. `WARD_TESTS_SELFTEST=1` removes one file from the observed
  // set for one run, which must be REFUSED. It is env-gated rather than committed into the data,
  // because a canary left in the list is not a test, it is an outage — learned 2026-08-30 from a
  // backup script that could not run for exactly that reason.
  if (process.env.WARD_TESTS_SELFTEST === "1") {
    const dropped = [...ran][0];
    ran.delete(dropped);
    console.log(`SELF-TEST: pretending "${dropped}" produced no result; this run MUST be refused.`);
  }

  // This is the ONE reconciliation that decides anything: the full original handed-in list against
  // the union of every batch's actual results. There is no separate per-batch pass/fail — batching
  // must never be allowed to turn "the whole run" into "each piece, judged on its own."
  const absent = handedIn.filter((f) => !ran.has(base(f)));
  const empty = allResults.filter((r) => (r.assertionResults ?? []).length === 0).map((r) => base(r.name));
  const lostBatches = batchOutcomes.filter((b) => b.lost);
  // `status !== 0` also catches `null` (killed by signal, no exit code) — never treat "didn't exit
  // cleanly" as equivalent to "exited 0". A later batch's clean exit must never overwrite an earlier
  // batch's non-zero one; this checks the whole set, not the last entry.
  const anyBatchNonZeroExit = batchOutcomes.some((b) => b.status !== 0);

  // WF-34 — see summariseSkips' own doc comment. Printed on every run, not only when a caller
  // thinks to ask: a file where every case is skipped is exactly the kind of thing a summary line
  // that only reports "passed" would silently absorb.
  const skipSummary = summariseSkips(allResults);

  console.log(
    `\n  files handed in : ${handedIn.length}` +
      `\n  files that ran  : ${ran.size}` +
      `\n  tests collected : ${totalTests}` +
      `\n  passed          : ${totalPassed}` +
      `\n  failed          : ${totalFailed}` +
      `\n  skipped/todo    : ${skipSummary.skippedOrTodo}` +
      `\n  wholly skipped  : ${skipSummary.whollySkippedFiles.length}` +
      (skipSummary.whollySkippedFiles.length > 0 ? ` — ${skipSummary.whollySkippedFiles.join(", ")}` : "") +
      `\n  batches run     : ${batches.length}${lostBatches.length > 0 ? ` (${lostBatches.length} lost their report)` : ""}` +
      `\n  vitest exit     : ${batchOutcomes.map((b) => b.status).join(", ")}`,
  );

  // Coverage discrepancies are checked BEFORE pass/fail. A run that lost a file is not
  // "passing with a caveat" — it is a run whose result is unknown for that file.
  if (absent.length > 0) {
    console.error(
      `\nREFUSED — ${absent.length} of ${handedIn.length} file(s) produced no result:\n  ${absent.join("\n  ")}\n` +
        (lostBatches.length > 0
          ? `\n${lostBatches.length} of ${batches.length} batch(es) never wrote a report (batch(es) ` +
            `${lostBatches.map((b) => b.index + 1).join(", ")}) — every file in a lost batch counts as unrun.\n`
          : "") +
        "\nThis is the P1-05 failure: vitest can print a pass line that agrees with itself and not\n" +
        "with its input, and exit 0. A dropped file is an UNKNOWN result, never a passing one.\n" +
        "Re-run; if it recurs, the worker is dying (look for VirtualAlloc/OOM above).",
    );
    return EXIT_COVERAGE_DISCREPANCY;
  }

  if (totalTests === 0) {
    console.error("\nREFUSED: zero tests collected. A selector matching nothing is not a pass.");
    return EXIT_COVERAGE_DISCREPANCY;
  }

  if (empty.length > 0) {
    console.error(`\nREFUSED: ${empty.length} file(s) ran but contain no test:\n  ${empty.join("\n  ")}`);
    return EXIT_COVERAGE_DISCREPANCY;
  }

  if (totalFailed > 0 || anyBatchNonZeroExit) {
    console.error(`\nFAILED: ${totalFailed} test(s) failed.`);
    // A red run must say WHY, not only THAT it was red. `--reporter=json` sends vitest's own failure
    // detail to the report FILE and not to stdout, so before this block a failing run printed a
    // count and nothing else — quietly defeating the discipline of reading the failure message
    // rather than its colour. Found 2026-08-30 while mutation-proving a label pin: the run went red
    // correctly, and the reason had to be dug out of the temp JSON afterwards to confirm it had
    // failed for the RIGHT reason. A tool that makes the right habit expensive is teaching the
    // wrong one.
    for (const file of allResults) {
      for (const assertion of file.assertionResults ?? []) {
        if (assertion.status !== "failed") continue;
        const [firstLine] = (assertion.failureMessages ?? []).join("\n").split("\n");
        console.error(`  ✗ ${assertion.fullName}\n    ${firstLine ?? "(no message recorded)"}`);
      }
    }
    const survivingReports = batchOutcomes.filter((b) => !b.lost).map((b) => b.reportPath);
    console.error(`\nFull report(s): ${survivingReports.join(", ") || "(none — every batch lost its report)"}`);
    return EXIT_TEST_FAILURE;
  }

  console.log(`\nOK — all ${handedIn.length} handed-in file(s) ran, ${totalPassed} test(s) passed.`);
  return EXIT_OK;
}

/**
 * True when this module was invoked directly (`node scripts/run-ward-tests.mjs ...`), false when
 * merely imported (e.g. by `tests/ward-run-ward-tests-skips.test.ts`, to reach `summariseSkips`).
 *
 * ⚠️ **COMPARING RAW PATH STRINGS — THE PREVIOUS FORM — FAILS SILENTLY ON WINDOWS.** `argv[1]` and
 * `import.meta.url` can each be spelled through a different drive-letter case, or resolve through a
 * junction one side doesn't go through, while naming the exact same file on disk. `path.resolve(...)
 * === fileURLToPath(...)` then compares two strings that both correctly identify this file but are
 * not textually identical, so `invokedDirectly` is `false`, `main()` never runs, and the process
 * exits 0 with no output — which reads exactly like "nothing was asked of it", not like a bug.
 *
 * `fs.realpathSync` resolves both sides through any symlink/junction to the same real path, and a
 * case-insensitive compare closes the drive-letter-case gap on win32 specifically (the one platform
 * whose filesystem is itself case-insensitive; comparing case-insensitively on a case-sensitive
 * platform would be the same class of bug in the other direction). `resolveRealPath` and `platform`
 * are injectable so this can be unit-tested for both the junction and the drive-letter-case case
 * without needing a real junction or a second OS — see `tests/ward-run-ward-tests-skips.test.ts`.
 *
 * @param {string | undefined} argv1
 * @param {string} moduleUrl
 * @param {{ resolveRealPath?: (p: string) => string, platform?: string }} [options] - narrowed to
 *   the single-argument shape this function actually calls `resolveRealPath` with (never
 *   `typeof realpathSync`'s full overload set, which also demands an unused `.native` method) so a
 *   plain test double can be passed without reimplementing `fs.realpathSync`'s whole signature.
 */
export function isDirectInvocation(
  argv1,
  moduleUrl,
  { resolveRealPath = realpathSync, platform = process.platform } = {},
) {
  if (!argv1) return false;
  const real = (p) => {
    try {
      return resolveRealPath(p);
    } catch {
      return p;
    }
  };
  const invoked = real(path.resolve(argv1));
  const self = real(fileURLToPath(moduleUrl));
  return platform === "win32" ? invoked.toLowerCase() === self.toLowerCase() : invoked === self;
}

/*
 * Guarded exactly like scripts/check-ward-expected-reds.mjs's own entrypoint: everything above is
 * safe to import (pure helpers, a function declaration), but calling main() spawns a real vitest
 * child process and calls process.exit() on completion — either of which, run as a side effect of
 * an import, would corrupt or kill whatever test run imported this module. Importing this file —
 * which tests/ward-run-ward-tests-skips.test.ts does, to reach summariseSkips — must never do that.
 */
if (isDirectInvocation(process.argv[1], import.meta.url)) {
  const admission = acquireHeavyRunLock({ projectRoot: process.cwd(), mode: "exclusive", command: "run-ward-tests" });
  if (process.env.WARD_OWNED_WARD_GATE === "1") {
    if (!admission.reentrant) {
      admission.release();
      throw new Error("Owned Ward collector requires validated inherited admission");
    }
    process.exit(main());
  } else {
    try {
      const result = await runOwnedChild(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
        env: { ...admission.environment, WARD_OWNED_WARD_GATE: "1" },
      });
      process.exitCode = result.status ?? 1;
    } finally {
      admission.release();
    }
  }
}
