#!/usr/bin/env node
/**
 * mutation-run.mjs — a mutation driver that cannot strand a mutant.
 *
 * ⚠️ **WHY THIS EXISTS AS A HARNESS RATHER THAN A HABIT.** On 2026-09-04 four Ward Flow sessions
 * independently found guards that could not fail, and the habit recommended for finding them —
 * break the thing, watch it go red, put it back — was itself run four different ways, none of them
 * crash-safe. One session's driver died after writing the mutant and before restoring it (Node
 * decoded a UTF-8 test stream as cp1252 and threw), leaving a deliberate falsehood on disk in a
 * repository where another session's pre-commit hook inspects the whole tree. **The file was
 * untracked and minutes old, so `git` had nothing to restore it from.** It was found because
 * somebody ran a status check out of reflex.
 *
 * **A reflex does not survive a tired session and does not transfer to whoever works on this next.**
 *
 * Each guard below is here because it was actually breached, not because it seemed prudent:
 *
 *   1. REFUSES AN UNTRACKED TARGET. Every discussion of mutation assumes version control is the
 *      backstop. For a new file it is not — and a new file is exactly what you mutate when you have
 *      just written a guard, so the exposure concentrates on the case the habit exists for.
 *   2. REFUSES A FIND STRING THAT DOES NOT MATCH EXACTLY ONCE. A non-global substitution silently
 *      prefers the first occurrence, which in this heavily-commented codebase is very often the doc
 *      comment ABOUT the value rather than the value. The mutation "applies", the suite goes green,
 *      and a green from a mutant that landed in prose reads exactly like a test that does not guard.
 *   3. PROVES THE MUTANT APPLIED, BY CONTENT. A mutation that never applied reports as a pass, and
 *      the pass is the only thing you see. Green after a mutation means one of two opposite things —
 *      the guard is weak, or nothing happened — and the run cannot tell you which.
 *   4. RESTORES IN A `finally`, FROM BYTES CAPTURED BEFORE THE EDIT. Not from `HEAD`: whenever the
 *      file carries uncommitted work, `HEAD` is a different thing from "the file a moment ago", and
 *      restoring to it silently discards the very change under test.
 *   5. VERIFIES THE RESTORE BY CONTENT and fails loudly on mismatch. A clean `git diff` is a weaker
 *      claim that looks identical and is also satisfied by a file that was never mutated at all.
 *   6. REPORTS WHICH ASSERTIONS WENT RED, not merely that something did. Two reds from one edit is
 *      not a stronger signal — it hides which half moved, and it is how an assertion that is not
 *      mapped to the site its name claims stays hidden.
 *
 * ⚠️ **AND THE ONE THING THIS HARNESS CANNOT CLOSE, WHICH BELONGS IN THE RECORD RATHER THAN IN A
 * DOCSTRING.** Guard 1 was written down in a personal note before the night it was needed, was
 * retrievable, and still did not reach the advice given to four sessions. **A lesson recorded is not
 * a lesson applied.** This closes that gap for one case. Nothing closes it in general.
 *
 * Usage:
 *   node scripts/ward-flow/mutation-run.mjs \
 *     --file src/components/ward-management/ward-patients.ts \
 *     --find "return age;" --replace "return 999;" \
 *     --command "npx vitest run tests/ward-patient-model.test.ts tests/ward-person-screen.dom.test.tsx"
 *
 *   node scripts/ward-flow/mutation-run.mjs --self-test
 *
 * Exit codes: 0 the mutant was caught (the run went red) · 1 the mutant SURVIVED (nothing caught
 * it — the finding) · 2 refused before mutating · 3 the restore failed (act now) · 4 INDETERMINATE:
 * the mutant never ran, so the result means nothing either way.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve, sep } from "node:path";

const REFUSED = 2;

/**
 * A stable, unique string that exists ONLY so `--self-test` has something safe to mutate in a
 * tracked file. Do not read it for anything, and do not reuse the text elsewhere or tidy it
 * away: the self-test anchors on it, and guard 2 refuses any anchor that does not match exactly
 * once — so a second copy anywhere in this file silently turns three verdict cases into
 * refusals, which the self-test would report as RED without saying why.
 */
const SELF_TEST_ANCHOR = "self-test-mutation-anchor-do-not-duplicate";
void SELF_TEST_ANCHOR;
const RESTORE_FAILED = 3;
// Neither caught nor survived. Kept distinct from both, because the failure mode
// this guards is a conclusion drawn from a run that did not happen.
const INDETERMINATE = 4;

function die(code, ...lines) {
  for (const line of lines) console.error(line);
  process.exit(code);
}

/** git's own object id, so the value is comparable with `git hash-object` and `git rev-parse`. */
function blobHash(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, "utf8");
  return createHash("sha1")
    .update(Buffer.concat([header, bytes]))
    .digest("hex");
}

// Windows can briefly refuse either write open (observed UNKNOWN/-4094, EBUSY, EPERM). Measured
 // 2026-09-22 on ward-lead: self-test children still exhausted a 770 ms window under rapid
// mutate-restore of this file, leaving SELF_TEST_ANCHOR as "mutated" when restore lost. Keep one
// bounded ~3.2 s policy for applying and restoring. Retry only that IO, never a command or a
// failed hash comparison; every attempt writes the same bytes supplied for that phase.
const RESTORE_RETRY_DELAYS_MS = [20, 50, 100, 200, 400, 800, 1600];
const TRANSIENT_FS_CODES = new Set(["UNKNOWN", "EBUSY", "EPERM"]);

function isTransientFsError(error) {
  return TRANSIENT_FS_CODES.has(error?.code);
}

function writeBytesWithTransientRetry(
  file,
  bytes,
  write = writeFileSync,
  pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms),
) {
  for (let attempt = 0; attempt <= RESTORE_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      write(file, bytes);
      return attempt + 1;
    } catch (error) {
      if (attempt === RESTORE_RETRY_DELAYS_MS.length || !isTransientFsError(error)) {
        throw error;
      }
      pause(RESTORE_RETRY_DELAYS_MS[attempt]);
    }
  }
}

function restoreCapturedBytes(file, bytes, write = writeFileSync, pause) {
  return writeBytesWithTransientRetry(file, bytes, write, pause);
}

function pauseMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** True when a child lost to a Windows open lock rather than a deliberate harness verdict. */
function isTransientMutationChildFailure(status, output) {
  if (status === RESTORE_FAILED) return true;
  if (/MUTANT APPLY FAILED[\s\S]{0,240}\b(UNKNOWN|EBUSY|EPERM)\b/.test(output)) return true;
  if (/RESTORE FAILED[\s\S]{0,480}\b(UNKNOWN|EBUSY|EPERM)\b/.test(output)) return true;
  return false;
}

function isTracked(file) {
  const probe = spawnSync("git", ["ls-files", "--error-unmatch", "--", file], {
    encoding: "utf8",
  });
  return probe.status === 0;
}

/**
 * The top of the worktree this process is running in — `--show-toplevel` rather than `--git-dir`,
 * because in a linked worktree the git dir lives under the MAIN checkout and would place every
 * containment check in the wrong tree.
 */
function gitRoot() {
  const probe = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  if (probe.status !== 0) die(REFUSED, "REFUSED: not inside a git worktree, so containment cannot be checked.");
  return probe.stdout.trim();
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[name] = true;
    } else {
      args[name] = next;
      i += 1;
    }
  }
  return args;
}

/**
 * Which assertions went red — guard 6.
 *
 * Deliberately reports the NAMES rather than a count. A count answers "did something catch it",
 * which is the question that hides a test asserting over the wrong site.
 */
function redAssertions(output) {
  const names = new Set();
  const reasons = [];
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.trim();
    const failing = line.match(/^[×✕x]\s+(.+?)(?:\s+\d+ms)?$/u);
    if (failing) names.add(failing[1].trim());
    if (/^(AssertionError|Error):/.test(line)) reasons.push(line);
  }
  return { names: [...names], reasons };
}

/**
 * DID ANYTHING GO RED — asked separately from WHICH assertion went red.
 *
 * 🔴 THIS SPLIT EXISTS BECAUSE THE VERDICT USED TO BE `names.length === 0`, AND
 * `names` COMES ONLY FROM VITEST'S `× <test name>` LINES, WHICH THE DOT REPORTER
 * DOES NOT PRINT. `--reporter=dot` is what this repository's own build plans tell
 * people to run, so the harness reported "🔴 THE MUTANT SURVIVED. Nothing went
 * red." for runs that had gone red — and it says a survived mutant means the
 * assertion cannot fail, which invites somebody to rewrite a guard that works.
 * A tool built to stop false confidence was manufacturing it, in the one
 * direction that costs you a working safeguard.
 *
 * Measured 2026-09-05 as a controlled pair: the same file, the same one-character
 * mutation and the same test, run twice with only the reporter changed.
 * `--reporter=dot` said SURVIVED; the default reporter said "caught by 1
 * assertion". Everything else was held constant.
 *
 * So the verdict now keys on the process status plus vitest's own summary, and
 * `names` is demoted to what it always was — the ANSWER TO A DIFFERENT AND
 * BETTER QUESTION, which is which assertion did it. When a run goes red without
 * naming anything, that is reported as caught-but-unnamed rather than silently
 * turned into its opposite.
 */
function failureSignal(output, status) {
  const summary = [];
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.trim();
    // "Tests  1 failed | 6 passed (7)" and "Test Files  1 failed (1)".
    //
    // ⚠️ `[1-9]\d*`, NOT `\d+`. The first version of this used `\d+`, which
    // matches ZERO — so "Tests  0 failed | 7 passed (7)" set summary.length > 0
    // and a fully green run read as CAUGHT, with no non-zero exit needed. Found
    // by Ward Verifier, 2026-09-05, by reading the regex rather than by seeing it
    // happen: whether today's reporter emits a zero-failure line or not, the
    // pattern accepted one, so it was latent regardless of the reporter.
    if (/^Test(s| Files)\s+[1-9]\d* failed/.test(line)) summary.push(line);
    // The per-file banner, printed by every reporter including dot.
    else if (/^FAIL\b/.test(line)) summary.push(line);
  }
  return { failed: status !== 0 || summary.length > 0, summary };
}

/**
 * DID THE TESTS ACTUALLY EXECUTE — asked separately from whether anything failed.
 *
 * Vitest prints a `Tests  …` summary line whenever it collected and ran at least
 * one test, under every reporter including dot. Its absence alongside a non-zero
 * exit means the process died before running anything: a parse error in the
 * mutant, a missing file, a runner that refused.
 */
function ranTests(output) {
  /*
   * 🔴 `[ \t]*`, AND ITS ABSENCE MADE THIS FUNCTION RETURN FALSE FOR EVERY REAL RUN.
   *
   * The first version was `/^Tests\s+\S/m`, anchored at column 0. **Vitest indents that summary
   * line by six spaces.** Measured with `cat -A`:
   *
   *     ␣␣␣␣␣␣Tests  3 passed (3)$
   *
   * So `ranTests` was false on every genuine vitest run, and `didNotRun`'s third clause —
   * `status !== 0 && !ranTests(output)` — fired on **every real catch**, because a real catch is
   * exactly "vitest exits non-zero". The harness could no longer report a caught mutant at all.
   *
   * ⚠️ **AND IT IS WORSE THAN THE BUG IT REPLACED.** The defect Ward Verifier found here earlier
   * made a guard that does nothing look proven. This one made a guard that WORKS look unproven —
   * and the doc comment in this file already names that harm: a wrong verdict here *"invites
   * somebody to rewrite a guard that works."*
   *
   * ⚠️ **THE OTHER FOUR ANCHORED MATCHES IN THIS FILE ARE FINE, AND THAT IS THE TELL.** Lines 124,
   * 126, 166 and 168 all run against `raw.trim()`. This was the only one matching raw output. One
   * file, two summary parsers, and only the untrimmed one was broken — so the working sibling three
   * dozen lines away was the available counter-example the whole time.
   *
   * Found by Ward Verifier, 2026-09-05, checking a fix I had reported green and asked nothing of it
   * about — on the stated grounds that a self-reported fix most needs a second reader precisely when
   * its author has just misread evidence twice in one night.
   */
  return /^[ \t]*Tests\s+\S/m.test(output);
}

/**
 * A mutant that never executed is neither caught nor survived, and the second is
 * the reading that gets published. `run-vitest.mjs` memoises a gate that already
 * passed on identical content and exits 0 WITHOUT running vitest, printing that
 * it did so. If that message is in the output, this harness must refuse to draw
 * any conclusion — an exit 0 from a run that did not happen is indistinguishable
 * from an exit 0 from a run that happened and passed.
 */
/**
 * POSITIVE EVIDENCE THAT SOMETHING ACTUALLY EXECUTED - runner-agnostic, unlike `ranTests`.
 *
 * `ranTests` looks for vitest's own summary line. A PLAYWRIGHT command never emits one, so
 * `didNotRun`'s third clause fired on every genuinely CAUGHT browser mutant and reported "the
 * mutant never ran". Ward Builder Three hit it on a real production-build run: a mutation that
 * failed with the exact assertion it was aiming at came back INDETERMINATE. The restore was
 * correct; only the verdict was wrong - and a wrong verdict here is the specific harm this file's
 * header warns about, because it invites somebody to rewrite a guard that works.
 *
 * THE FIRST FIX I TRIED WAS TO NARROW THE CLAUSE TO VITEST COMMANDS, AND THE SELF-TEST REFUSED IT.
 * Two INVERSE cases went red, correctly: narrowing by command text would have restored the original
 * defect for every non-vitest runner - a Playwright process that died having run nothing would once
 * again be reported CAUGHT. The self-test caught a fix that traded one runner's false negative for
 * another runner's false positive.
 *
 * So the question asked is not "was this vitest" but "is there evidence a test executed". A named
 * failing test or an assertion message is that evidence in any runner, and `redAssertions` already
 * extracts both from trimmed output. This deliberately does NOT try to recognise Playwright's
 * summary format: writing that from memory would be a stand-in typed by whoever wrote the parser,
 * which is the exact failure Ward Verifier caught in this same file a few hours ago.
 */
function ranEvidence(output) {
  if (ranTests(output)) return true;
  const red = redAssertions(output);
  return red.names.length > 0 || red.reasons.length > 0;
}

function didNotRun(output, status) {
  if (/reused receipt, not a fresh run|\[gate-receipts\] REUSED/.test(output)) {
    return "the command reused a recorded gate receipt and exited without running vitest";
  }
  // 🔴 THE ONE THAT FIRES ON THIS MACHINE, AND IT FIRED THREE TIMES IN ONE
  // SESSION. `scripts/run-heavy.mjs` exits 75 with this marker when another
  // worktree holds the heavy-run lease. 75 is non-zero, so the previous verdict
  // called it CAUGHT — while nothing ran at all. And `npm run test` is the
  // obvious thing to put in --command, so with several sessions live a mutation
  // run that loses the lease race certified the guard as working having executed
  // nothing. Found by Ward Verifier with a control, 2026-09-05.
  if (status === 75 || /DATABASE_HEAVY_RUN_ADMISSION_BUSY/.test(output)) {
    return "another worktree held the heavy-run lease, so the command exited 75 without running vitest";
  }
  // A non-zero exit with no `Tests …` summary anywhere: the process died before
  // running a test. The worst case is a SYNTACTICALLY INVALID MUTANT — vitest
  // exits non-zero, no assertion executes, and the old verdict said CAUGHT. That
  // is worse than the lease case because an invalid mutant is MORE likely on an
  // aggressive mutation, which is exactly when the verdict matters most.
  //
  // NARROWED 2026-09-05: THIS CLAUSE ONLY APPLIES TO A VITEST COMMAND, and the first version did
  // not say so. `ranTests` looks for vitest's own summary line. A PLAYWRIGHT command never emits
  // one, so every genuinely CAUGHT browser mutant came back as "the mutant never ran".
  //
  // Ward Builder Three hit it on a real production-build run: a mutation that failed with the
  // exact assertion it was aiming at was reported INDETERMINATE. The restore was correct and only
  // the verdict was wrong - but a wrong verdict here is the specific harm this file's own header
  // warns about, because it invites somebody to rewrite a guard that works.
  //
  // THE FIX IS TO NARROW THE HEURISTIC, NOT TO GUESS ANOTHER RUNNER'S OUTPUT FORMAT. A Playwright
  // summary pattern written from memory would be a stand-in typed by whoever wrote the parser -
  // the exact failure Ward Verifier caught in this file a few hours ago. The two clauses above
  // still apply to every runner: a reused receipt and a lease refusal are both detectable without
  // knowing what a test summary looks like.
  //
  // So a non-vitest command falls through to the ordinary red/green signal, and the failing test
  // name plus the assertion message settle it, as they always did for browser gates.
  if (status !== 0 && !ranEvidence(output)) {
    return `the command exited ${status} without vitest running a single test — a parse error in the mutant, a missing file, or a runner that refused`;
  }
  return null;
}

/**
 * 🔴 **APPEND MODE EXISTS BECAUSE THE HIGHEST-VALUE CONTROL ANYONE RAN COULD NOT USE THIS HARNESS.**
 *
 * A sweep plants the same probe into every file it covers — 51 ward stylesheets, on 2026-09-06 —
 * and there is no anchor to give `--find`. Guard 2 refuses it, correctly (`--find matched 30 times
 * … it must match exactly once`), and so the sweep stayed hand-rolled. ⚠️ **That is exactly where
 * the damage happened:** the hand-rolled version truncated an 87-line fixture to two by opening it
 * for writing before reading it, **and the control still went red**, because a file containing only
 * the planted violation gives the same verdict as an intact file containing it.
 *
 * **So the mode that was missing is the mode covering the failure this tool exists to prevent.**
 *
 * ⚠️ **ONLY GUARD 2 IS BYPASSED, AND ONLY BECAUSE IT HAS NOTHING TO DISAMBIGUATE.** There is no
 * anchor, so there is no wrong occurrence to prefer. Every other guard runs on the same path as
 * `--find`/`--replace`, deliberately sharing the code rather than getting a parallel one:
 *
 *   Guard 1  untracked refusal          unchanged — and it is the guard that bit
 *   Guard 3  prove the mutant landed    unchanged — an empty `--append` leaves the file
 *                                       byte-identical and is refused by it
 *   Guard 4  restore from captured bytes, in a `finally`      unchanged
 *   Guard 5  verify the restore by content, loudly            unchanged
 *   Guard 6  name the assertions that went red                unchanged
 *
 * **A new mode that quietly relaxed a second guard would be worse than no mode**, because everybody
 * who trusts the first one would trust it. The self-test exercises Guard 1 and Guard 3 through
 * `--append` specifically, so that claim is executed rather than asserted here.
 *
 * The probe lands on its own line: a newline is added first when the file does not end with one,
 * and one after. Nothing else about the existing content is touched. **On a CRLF file the probe's
 * own line is terminated with a bare `\n` while the rest of the file is CRLF** — harmless, since
 * the restore is from captured bytes and is exact either way, and noted only so that somebody
 * meeting a mixed-ending mutant does not go looking for a cause.
 *
 * ## 🔴 TWO THINGS `SURVIVED` MEANS IN APPEND MODE THAT IT DOES NOT MEAN WITH `--find`
 *
 * Both found by Ward Builder Three on review, 2026-09-06, after running their real 51-file sweep
 * through this mode — 51 caught, 51 named, 0 survived, 0 restore mismatches. **Neither can be
 * refused mechanically, which is why they are written here rather than added as a guard.**
 *
 *   1. **A PROBE THE GATE CANNOT SEE REPORTS AS `SURVIVED`.** Appending a CSS comment — a block
 *      comment containing the word "probe", written out here in words because quoting one inside
 *      this doc comment would close it — changes the bytes, so guard 3 is satisfied; nothing
 *      functional was mutated, so nothing can go red; and
 *      the verdict reads as *"no assertion covers this"*. ⚠️ **This is the non-degenerate form of
 *      the empty-append bug refused at the CLI above.** **Confirm your probe is functional before
 *      believing a survival.**
 *
 *      🔴 **AND IT CANNOT BE CLOSED, FOR A REASON THAT IS THE WHOLE POINT: THE REFUSAL ABOVE IS
 *      SYNTACTIC — "is this whitespace?" — WHILE THE PROPERTY THAT MATTERS IS SEMANTIC — "can the
 *      gate under test see it?" Those can never be the same test.** A `@media print{}` probe is
 *      inert for a status-colour ratchet and a perfectly good probe for a print-styles guard.
 *      **Inertness is relative to the GATE, not to the string**, so no input validation can decide
 *      it — and a validator rejecting those inputs would break the mode for exactly the guards
 *      they are legitimate probes for.
 *
 *      **The family, measured by Ward Builder Three rather than reasoned about:**
 *
 *          (empty) · space · tab · lone newline        REFUSED
 *          a CSS comment · a bare `;` · `@media print{}`   RAN, then SURVIVED
 *          a declaration reading a status token         RAN, then CAUGHT
 *
 *      ✅ **So `trim() === ""` closes the ENTIRE whitespace class, not merely the empty string** —
 *      broader than I claimed when I wrote it, which is the rarer direction for a claim to be
 *      wrong in. **The remainder is open by construction. Do not add refusals to it.**
 *   2. **APPEND MODE CHOOSES THE SITE, AND THAT WEAKENS ONLY ONE VERDICT.** With `--find` you place
 *      the mutant where the guard looks. Here it always lands at end of file, top level, outside
 *      every at-rule — so a guard that only inspects inside `@media (forced-colors: active)` will
 *      report `SURVIVED` **while being perfectly correct not to look there.**
 *
 *      **`CAUGHT` is exactly as strong as in find mode. `SURVIVED` is weaker:** it means *"no
 *      assertion covers a probe AT END OF FILE"*, not *"no assertion covers this"*. ⚠️ **A survival
 *      is the verdict people act on**, so the difference belongs beside the mode rather than in
 *      somebody's memory.
 */
function runMutation(
  { file, find, replace, append, command },
  { write = writeFileSync, runCommand = spawnSync } = {},
) {
  const absolute = resolve(file);

  if (!existsSync(absolute)) die(REFUSED, `REFUSED: no such file — ${file}`);

  /*
   * ⚠️ **GUARD 0 — THE MUTANT MUST LAND INSIDE THIS WORKTREE, AND UNTIL 2026-09-06 NOTHING SAID SO.**
   *
   * `resolve()` accepts an absolute path, so `--file D:/Worktrees/Database/ward-lead/tests/x.tsx`
   * was a legal instruction: edit a file in a worktree ANOTHER LIVE CHAT IS HOLDING, then restore it
   * from bytes this process captured. **Every existing guard here protects the file; none of them
   * asked whose file it is.**
   *
   * Added after Ward Lead found `tests/ward-capacity-view.dom.test.tsx` in its own worktree grown
   * from 367 lines to 1101 — its own content three times over — by something that reached in by
   * absolute path. **This tool did not do it** (append mode writes the literal `--append` string and
   * never a file's own content, it appends once, and every run today restored byte-identical), and
   * the check exists anyway: *"it was not us this time"* is not a control, and the next tool to grow
   * an append mode inherits this one's shape.
   *
   * ⚠️ **The restore is what makes cross-worktree writing quietly dangerous rather than loudly so.**
   * A mutation that restores perfectly leaves no trace at all — so a run against somebody else's
   * tree looks exactly like a run against your own, right up until their uncommitted work is the
   * thing being restored over.
   */
  /*
   * ⚠️ **`realpathSync`, NOT `resolve`, AND IT MATTERS IN BOTH DIRECTIONS.**
   *
   * `resolve` does not follow symlinks, so a link INSIDE this worktree pointing at somebody else's
   * would have passed a `startsWith` check and written straight through it — the containment
   * check would have been asked about the path, not about the file. And on Windows it does not
   * normalise case or 8.3 short names, so `D:\WORKTREES\...` or a `PROGRA~1`-style path would have
   * been REFUSED while naming a file in this very tree. **A containment guard that refuses correct
   * work gets widened until it contains nothing.**
   *
   * Both ends are resolved, because comparing a real path against a symlinked root fails the same
   * way round the other direction.
   */
  const worktreeRoot = realpathSync(resolve(gitRoot()));
  const target = realpathSync(absolute);
  const inside = target === worktreeRoot || target.startsWith(worktreeRoot + sep);
  if (!inside) {
    die(
      REFUSED,
      `REFUSED: ${file} is OUTSIDE this worktree.`,
      "",
      `  worktree: ${worktreeRoot}`,
      `  target:   ${target}`,
      "",
      "  Another chat may be holding that tree, and a mutation there edits their working copy and",
      "  then restores it — which succeeds silently while destroying anything they had uncommitted.",
      "  Run the harness from the worktree that owns the file instead.",
    );
  }

  // Guard 1 — the one that bit, and the one nobody does.
  if (!isTracked(file)) {
    die(
      REFUSED,
      `REFUSED: ${file} is UNTRACKED.`,
      "",
      "  Version control cannot restore a file it has never seen, so if this run dies between the",
      "  edit and the restore, the only recovery is reversing the edit by hand — which is possible",
      "  only if somebody knows an edit is there.",
      "",
      "  Commit the file first. A new file is exactly what you mutate when you have just written a",
      "  guard, which is why this refusal exists rather than a warning.",
    );
  }

  const original = readFileSync(absolute);
  const originalHash = blobHash(original);
  const text = original.toString("utf8");

  // Guard 2 — a non-global substitution silently prefers a comment. SKIPPED in append mode, where
  // there is no anchor and therefore no wrong occurrence to prefer. Nothing else is skipped.
  const occurrences = append === undefined ? text.split(find).length - 1 : 1;
  if (occurrences !== 1) {
    /*
     * 🔴 A MULTI-LINE --find CAN NEVER MATCH A CRLF FILE, AND THE ADVICE HERE USED TO SEND YOU
     * SOMEWHERE ELSE ENTIRELY.
     *
     * This repository is checked out on Windows, so working files routinely hold CRLF while the
     * committed blob holds LF. A `--find` typed with `\n` between two lines then matches the blob
     * and NOT the file on disk, which is what this guard reads. The old message offered "Prettier
     * may have reflowed the line" — plausible, wrong, and expensive: it points the reader at the
     * formatter rather than at the line endings, and a single-line anchor works fine, so nothing
     * else in the session contradicts it.
     *
     * ⚠️ The refusal itself is correct behaviour and stays. A mutation harness that guessed at what
     * you meant would be worse than one that stops. What was wrong was only the diagnosis, and a
     * confident wrong diagnosis in a tool nobody re-reads is how an hour goes missing.
     */
    const crlfWouldMatch =
      occurrences === 0 && find.includes("\n") && text.replaceAll("\r\n", "\n").split(find).length - 1 === 1;
    die(
      REFUSED,
      `REFUSED: --find matched ${occurrences} times in ${file}; it must match exactly once.`,
      crlfWouldMatch
        ? "  IT WOULD MATCH EXACTLY ONCE WITH LF LINE ENDINGS. This file holds CRLF on disk while its\n" +
            "  committed blob holds LF, so a multi-line --find typed with \\n matches the blob and not the\n" +
            "  working file. This is not a formatting problem and re-running will not fix it.\n" +
            "  Anchor on a SINGLE line instead, or split the change into one mutation per line."
        : occurrences === 0
          ? "  Nothing to mutate. Prettier may have reflowed the line you anchored on, or — if your\n" +
            "  --find spans lines — this file may hold CRLF while your pattern assumes LF."
          : "  Ambiguous. The first match in this codebase is very often the doc comment ABOUT the\n" +
            "  value rather than the value — anchor on the whole declaration or JSX element instead.",
    );
  }

  console.log(`pre-mutation blob  ${originalHash}  ${file}`);

  let mutantApplied = false;
  let applicationError;
  let exitCode = 0;

  try {
    const mutated =
      append === undefined ? text.replace(find, replace) : `${text}${text.endsWith("\n") ? "" : "\n"}${append}\n`;
    try {
      const attempts = writeBytesWithTransientRetry(absolute, mutated, write);
      if (attempts > 1) console.warn(`mutant write recovered after ${attempts} attempts; verifying applied bytes`);
    } catch (error) {
      // A failed open may still have changed bytes before Node reported the error, so this says
      // only what is known: Guard 3 never verified the mutant. The finally below still restores
      // the captured original bytes and verifies their hash exactly as before.
      console.error("MUTANT APPLY FAILED — application was not verified.");
      console.error(`     ${error?.code ?? "error"} ${error?.syscall ?? ""}: ${error?.message ?? error}`);
      applicationError = error;
      exitCode = INDETERMINATE;
      throw error;
    }

    // Guard 3 — prove it landed. A mutation that never applied reports as a pass.
    const afterHash = blobHash(readFileSync(absolute));
    if (afterHash === originalHash) {
      die(
        REFUSED,
        "REFUSED: the file is byte-identical after the edit — the mutant did NOT apply.",
        "  Do not interpret any run from here; a non-run and a weak guard are the same colour.",
      );
    }
    mutantApplied = true;
    console.log(`mutant blob        ${afterHash}  (applied)`);
    console.log(`running: ${command}\n`);

    // Explicit utf8 on both streams. Decoding a UTF-8 test stream as the Windows code page is what
    // killed the driver this harness replaces — and it died AFTER writing the mutant.
    const run = runCommand(command, {
      shell: true,
      encoding: "utf8",
      env: { ...process.env, LC_ALL: "C.UTF-8", PYTHONIOENCODING: "utf-8" },
      maxBuffer: 64 * 1024 * 1024,
    });

    const output = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
    process.stdout.write(output);

    const { names, reasons } = redAssertions(output);
    const { failed, summary } = failureSignal(output, run.status);
    console.log("\n──────── mutation result ────────");

    const didNot = didNotRun(output, run.status);
    if (didNot) {
      console.log("⚠️  INDETERMINATE — THE MUTANT NEVER RAN.");
      console.log(`   ${didNot},`);
      console.log("   so this says nothing about whether an assertion covers the mutation.");
      console.log("   A verdict from a run that did not happen is indistinguishable from one that did.");
      console.log("   Re-run when the lease is free, or with GATE_RECEIPTS=refresh, as applicable.");
      exitCode = INDETERMINATE;
    } else if (!failed) {
      console.log("🔴 THE MUTANT SURVIVED. Nothing went red.");
      console.log("   Either no assertion covers this, or the one that claims to cannot fail.");
      exitCode = 1;
    } else if (names.length === 0) {
      // Red, but the reporter did not name the test. Do not call this survived:
      // that is the exact inversion this harness shipped with until 2026-09-05.
      console.log("✅ caught — the run went red, but this reporter did not name the assertion.");
      for (const line of summary.slice(0, 3)) console.log(`   ${line}`);
      for (const reason of reasons.slice(0, 4)) console.log(`   ${reason}`);
      console.log("");
      console.log("⚠️  WHICH assertion went red is the more useful half and you do not have it.");
      console.log("   Drop --reporter=dot from the command and run again to get the test name;");
      console.log("   a mutation caught by the wrong assertion looks identical to one caught by");
      console.log("   the right one.");
    } else {
      console.log(`✅ caught by ${names.length} assertion${names.length === 1 ? "" : "s"}:`);
      for (const name of names) console.log(`   × ${name}`);
      for (const reason of reasons.slice(0, 4)) console.log(`     ${reason}`);
      if (names.length > 1) {
        console.log(
          "\n⚠️  MORE THAN ONE WENT RED FOR ONE EDIT. That is not a stronger signal — check that\n" +
            "   each of these is really asserting over the site its name claims, rather than two\n" +
            "   assertions sharing one predicate.",
        );
      }
    }
  } catch (error) {
    if (error !== applicationError) throw error;
  } finally {
    // Guard 4 — restore from the bytes captured before the edit, never from HEAD.
    try {
      const attempts = restoreCapturedBytes(absolute, original, write);
      if (attempts > 1) console.warn(`restore write recovered after ${attempts} attempts; verifying captured bytes`);
    } catch (error) {
      console.error("🔴🔴 RESTORE FAILED — A MUTANT MAY BE ON DISK RIGHT NOW.");
      console.error(
        `     phase    ${
          mutantApplied ? "after verified mutant application" : "before mutant application was verified"
        }`,
      );
      console.error(`     expected ${originalHash}`);
      console.error(`     file     ${file}`);
      console.error(`     ${error?.code ?? "error"} ${error?.syscall ?? ""}: ${error?.message ?? error}`);
      console.error("     Do not commit anything from this tree until it is resolved.");
      process.exitCode = RESTORE_FAILED;
      return;
    }
    const restoredHash = blobHash(readFileSync(absolute));

    // Guard 5 — verify by content, and be loud.
    if (restoredHash === originalHash) {
      console.log(`restored           ${restoredHash}  (byte-identical)`);
    } else {
      console.error("");
      console.error("🔴🔴 RESTORE FAILED — A MUTANT MAY BE ON DISK RIGHT NOW.");
      console.error(`     expected ${originalHash}`);
      console.error(`     actual   ${restoredHash}`);
      console.error(`     file     ${file}`);
      console.error("     Do not commit anything from this tree until it is resolved.");
      process.exitCode = RESTORE_FAILED;
      return;
    }
    if (!mutantApplied) process.exitCode = REFUSED;
  }

  process.exitCode = exitCode;
}

/**
 * Anti-vacuity: a harness that cannot fail would be the exact defect it exists to find.
 *
 * Each case asserts the harness REFUSES or REPORTS something, against a real temporary file — so a
 * change that made the guards inert takes this red rather than leaving it silently permissive.
 */
/**
 * **THE PRECONDITION: THIS FILE'S OWN ANCHOR MUST BE AS COMMITTED BEFORE THE SELF-TEST STARTS.**
 *
 * 🔴 **THE SELF-TEST MUTATES THIS VERY FILE, SIX TIMES, AND RESTORES EACH TIME.** `tracked` is
 * `scripts/ward-flow/mutation-run.mjs` and every `verdictCase` replaces SELF_TEST_ANCHOR's value
 * with "mutated". **A run interrupted between the write and the restore leaves the anchor mutated
 * on disk, and nothing notices** — measured 2026-09-07, where it sat for over an hour, through a
 * fold and several suite runs, and was found only by a routine `git status`.
 *
 * ⚠️ **WHAT THE NEXT RUN DOES WITHOUT THIS GUARD IS THE REASON IT EXISTS.** Measured, by
 * re-applying the leftover state deliberately: **all six verdict cases go RED at exit 2 (REFUSED)**,
 * because guard 2 refuses an anchor that does not match exactly once. **Six REDs reads as a
 * catastrophically broken harness. The cause is a leftover from an interrupted run, and nothing in
 * that output says so.** This turns an hour of latent poison into an immediate refusal that names
 * the cause.
 *
 * 🔴 **THE EXPECTED VALUE COMES FROM GIT, NOT FROM THIS FILE, AND THAT IS THE WHOLE DESIGN.**
 * A precondition comparing the anchor against a literal written here would be comparing the file
 * against itself, and a baseline taken from the thing under test inherits whatever is already wrong
 * with it. ⚠️ **It would also be self-defeating a second way: a hard-coded copy of the anchor text
 * would be a SECOND occurrence in this file, which is precisely what guard 2 refuses.** Reading the
 * committed blob avoids both.
 *
 * ⚠️ **THE OCCURRENCE COUNT IS COMPARED TOO, against the committed count rather than a literal 1** —
 * so it catches a duplicated anchor as well as a changed one, and stays correct if the committed
 * file ever legitimately mentions the text twice.
 *
 * ⚠️ **ONLY THE ANCHOR IS COMPARED, never the whole file.** Anyone editing this harness has an
 * uncommitted diff by definition; refusing on that would make the guard fire on ordinary work, and
 * a guard that blocks correct work gets disabled rather than obeyed.
 *
 * ⚠️ **IF GIT CANNOT ANSWER, THIS SAYS SO AND CONTINUES.** A precondition that silently passes when
 * it could not run is indistinguishable from one that checked, so the one thing it must never do is
 * print nothing.
 */
function assertAnchorPristine() {
  const self = "scripts/ward-flow/mutation-run.mjs";
  const DECLARATION = /const SELF_TEST_ANCHOR = "([^"]*)";/u;

  const liveSource = readFileSync(self, "utf8");
  const live = DECLARATION.exec(liveSource);
  if (live === null) {
    die(
      REFUSED,
      `${self} no longer declares SELF_TEST_ANCHOR in the shape this precondition reads.`,
      "Either the declaration was reshaped, or a mutation replaced it. Compare it with HEAD before running the self-test.",
    );
  }

  const committed = spawnSync("git", ["show", `HEAD:${self}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  const unverified = (why) => {
    console.log(`⚠️  ANCHOR PRECONDITION NOT VERIFIED — ${why}`);
    console.log("    Continuing. A leftover anchor from an interrupted run would NOT have been caught.");
  };
  if (committed.status !== 0 || typeof committed.stdout !== "string" || committed.stdout === "") {
    unverified("git could not read the committed copy of this file.");
    return;
  }
  const want = DECLARATION.exec(committed.stdout);
  if (want === null) {
    unverified("the committed copy declares no anchor to compare against.");
    return;
  }

  const liveCount = liveSource.split(want[1]).length - 1;
  const wantCount = committed.stdout.split(want[1]).length - 1;

  if (live[1] !== want[1] || liveCount !== wantCount) {
    /*
     * ⚠️ LEFTOVER FROM AN INTERRUPTED SELF-TEST, MEASURED 2026-09-07 AND AGAIN 2026-09-22.
     * The self-test replace string is the literal "mutated". When restore loses a Windows open
     * race, that is what sits on disk. Auto-heal that one shape — surgical, preserving any other
     * uncommitted harness edits — rather than turning the next suite run into six inexplicable
     * REFUSED reds. Any other drift still refuses: that is real damage, not a stranded self-test.
     */
    if (live[1] === "mutated" && want[1] !== "mutated") {
      const healed = liveSource.replace(DECLARATION, `const SELF_TEST_ANCHOR = "${want[1]}";`);
      try {
        writeBytesWithTransientRetry(self, healed);
        const after = readFileSync(self, "utf8");
        const afterMatch = DECLARATION.exec(after);
        if (afterMatch?.[1] === want[1] && after.split(want[1]).length - 1 === wantCount) {
          console.warn(
            "⚠️  healed leftover SELF_TEST_ANCHOR mutant (value was \"mutated\") from an interrupted self-test;",
          );
          console.warn("    continuing. A Windows restore race left it; the suite must not stay red for that.");
          return;
        }
      } catch (error) {
        console.error(`could not heal leftover anchor: ${error?.code ?? "error"} ${error?.message ?? error}`);
      }
    }
    die(
      REFUSED,
      "REFUSED before mutating: this file's own self-test anchor is not as committed.",
      `  on disk:   "${live[1]}"  (${liveCount} occurrence${liveCount === 1 ? "" : "s"})`,
      `  committed: "${want[1]}"  (${wantCount} occurrence${wantCount === 1 ? "" : "s"})`,
      "",
      "The self-test mutates THIS FILE and restores it. A run interrupted between the two leaves the",
      "anchor like this, and the next run reports every verdict case RED at exit 2 — which reads as a",
      "broken harness rather than as a leftover from a previous run.",
      "",
      `  Fix:  git restore ${self}      (or: git checkout HEAD -- ${self})`,
    );
  }
}

function selfTest() {
  const dir = resolve("scripts/ward-flow/.mutation-self-test");
  const file = `${dir}/subject.txt`;
  mkdirSync(dirname(file), { recursive: true });
  let failures = 0;
  // Captured after assertAnchorPristine — the only safe bytes to put back if a child loses a
  // Windows restore race mid-suite. HEAD is wrong whenever this file has uncommitted harness work.
  const tracked = "scripts/ward-flow/mutation-run.mjs";
  const pristineTracked = readFileSync(tracked);
  const pristineTrackedHash = blobHash(pristineTracked);

  const check = (label, actual, expected) => {
    const ok = actual === expected;
    console.log(`${ok ? "  ok  " : "  RED "} ${label} (exit ${actual}, expected ${expected})`);
    if (!ok) failures += 1;
  };

  const ensureTrackedPristine = (reason) => {
    let live;
    try {
      live = readFileSync(tracked);
    } catch (error) {
      throw new Error(`self-test could not read ${tracked} after ${reason}: ${error?.message ?? error}`);
    }
    if (blobHash(live) === pristineTrackedHash) return;
    console.warn(`self-test: repairing ${tracked} after ${reason}`);
    restoreCapturedBytes(tracked, pristineTracked);
    if (blobHash(readFileSync(tracked)) !== pristineTrackedHash) {
      throw new Error(`self-test could not restore ${tracked} after ${reason}`);
    }
  };

  const invokeResultOnce = (args) => {
    const run = spawnSync(process.execPath, [resolve("scripts/ward-flow/mutation-run.mjs"), ...args], {
      encoding: "utf8",
    });
    // Preserve a child crash/restore error instead of reducing it to an unexplained RED.
    if (run.error || run.signal || run.status === null || /Error|RESTORE FAILED/u.test(run.stderr ?? "")) {
      console.error(
        `mutation child: status=${run.status}, signal=${run.signal}, error=${run.error?.message ?? "none"}`,
      );
      if (run.stdout) console.error(`child stdout:\n${run.stdout}`);
      if (run.stderr) console.error(run.stderr);
    }
    return run;
  };

  const invokeResult = (args) => {
    const touchesTracked = args.includes(tracked);
    const maxAttempts = touchesTracked ? 4 : 1;
    let run;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      run = invokeResultOnce(args);
      const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;
      if (touchesTracked) {
        try {
          ensureTrackedPristine(`child status ${run.status} (attempt ${attempt})`);
        } catch (error) {
          console.error(String(error?.message ?? error));
          if (attempt === maxAttempts) return run;
          pauseMs(100 * attempt);
          continue;
        }
      }
      if (!touchesTracked || !isTransientMutationChildFailure(run.status, output) || attempt === maxAttempts) {
        return run;
      }
      console.warn(
        `self-test: Windows file lock on mutation child (attempt ${attempt}/${maxAttempts}); retrying`,
      );
      pauseMs(100 * attempt);
    }
    return run;
  };
  const invoke = (args) => invokeResult(args).status;

  try {
  const restoreFixture = Buffer.from("captured original bytes");
  let restoreAttempts = 0;
  let sameCapturedBytes = true;
  restoreCapturedBytes(
    "restore-control",
    restoreFixture,
    (_file, bytes) => {
      restoreAttempts += 1;
      sameCapturedBytes &&= bytes === restoreFixture;
      if (restoreAttempts < 3) throw Object.assign(new Error("temporary open refusal"), { code: "UNKNOWN" });
    },
    () => {},
  );
  check(
    "restore retries transient IO using the identical captured buffer",
    restoreAttempts === 3 && sameCapturedBytes ? 0 : 1,
    0,
  );
  for (const [code, expectedAttempts] of [
    ["EPERM", RESTORE_RETRY_DELAYS_MS.length + 1],
    ["EACCES", 1],
  ]) {
    let attempts = 0;
    let thrown;
    const expectedError = Object.assign(new Error("restore refused"), { code });
    try {
      restoreCapturedBytes(
        "restore-control",
        restoreFixture,
        () => {
          attempts += 1;
          throw expectedError;
        },
        () => {},
      );
    } catch (error) {
      thrown = error;
    }
    check(
      `restore ${code} remains failed after exactly ${expectedAttempts} attempt(s)`,
      thrown === expectedError && attempts === expectedAttempts ? 0 : 1,
      0,
    );
  }

  writeFileSync(file, "alpha\n", "utf8");
  check(
    "refuses an untracked target",
    invoke(["--file", file, "--find", "alpha", "--replace", "beta", "--command", "true"]),
    REFUSED,
  );

  /*
   * 🔴 APPEND MODE — THE BYPASS MUST BE EXACTLY ONE GUARD WIDE, AND THESE EXECUTE THAT CLAIM.
   *
   * `--append` exists because a sweep has no anchor and guard 2 refuses it, which left the
   * highest-value shape of control hand-rolled — the shape where a fixture was truncated to two
   * lines and the control still went red. The danger in adding a mode is that it quietly relaxes
   * a SECOND guard, and it would then be trusted by everybody who trusts the first.
   *
   * So: guard 1 must still refuse an untracked target through the new path, and guard 3 must
   * still refuse an append that does not change the file. Both are asserted here rather than
   * argued in a comment, because a comment claiming a guard applies is worth nothing.
   */
  check(
    "APPEND: guard 1 still refuses an untracked target — the bypass is not a second door",
    invoke(["--file", file, "--append", ".probe { color: red; }", "--command", "true"]),
    REFUSED,
  );
  check(
    "APPEND: refuses being combined with --find, rather than choosing between them",
    invoke(["--file", file, "--append", "x", "--find", "alpha", "--replace", "beta", "--command", "true"]),
    REFUSED,
  );

  // A tracked file that certainly exists, mutated with an anchor that cannot match.
  /**
   * ⚠️ ASSEMBLED AT RUNTIME, AND THE FIRST VERSION OF THIS TEST WENT RED BECAUSE IT WAS NOT.
   *
   * It searched for a literal absent-anchor string — which then occurred exactly once, in this
   * file, because writing the test put it here. The harness matched it, mutated, ran, and correctly
   * reported a surviving mutant; the self-test read that as a broken refusal.
   *
   * **That is guard 2's own defect, committed inside guard 2's test**: the needle was in the
   * haystack because somebody wrote it there — the same reason a doc comment about a value is so
   * often the first textual match for it. **A subject that contains its own probe cannot test an
   * absence.**
   */
  const absentAnchor = ["@@", "no", "such", "anchor", "@@"].join("~");
  check(
    "refuses a find string matching zero times",
    invoke(["--file", tracked, "--find", absentAnchor, "--replace", "x", "--command", "true"]),
    REFUSED,
  );
  check(
    "refuses an ambiguous find string",
    invoke(["--file", tracked, "--find", "const", "--replace", "let", "--command", "true"]),
    REFUSED,
  );

  /**
   * THE VERDICT CASES, AND WHY THEY ARE HERE RATHER THAN ASSUMED.
   *
   * Until 2026-09-05 this self-test walked the three REFUSALS and nothing else,
   * so the harness shipped for a day with its verdict INVERTED for any command
   * using `--reporter=dot` — the reporter this repository's own build plans
   * prescribe. It printed "THE MUTANT SURVIVED" for runs that had gone red, and
   * a survived mutant is defined here as "no assertion covers this", so the
   * reading invites somebody to rewrite a guard that works.
   *
   * Every guard fired throughout. The conclusion was still wrong, and
   * "self-test: all guards fire" read as a clean bill of health for the tool.
   *
   * These drive the real binary with a stand-in command, so they pin the WIRING.
   * A unit test of the helpers would not have caught the original defect,
   * because the original defect had no helper — the verdict was
   * `names.length === 0` written inline.
   *
   * Case 1 is the discriminating one: a non-zero exit with no `×` line is
   * exactly the dot-reporter shape, and the old code called that survival.
   */
  // ⚠️ THE STAND-IN MUST LOOK LIKE WHAT THE DOT REPORTER ACTUALLY EMITS, and the
  // first version of it did not. It printed a FAIL banner and no `Tests …`
  // summary — which is precisely the shape of a COLLECT ERROR, where no assertion
  // executes and INDETERMINATE is the correct verdict. So the case went red
  // against correct logic, and "fixing" it by loosening the logic would have
  // re-opened the very defect this round closed.
  //
  // A real red run under --reporter=dot prints BOTH lines. Verified against a
  // genuine failing run earlier tonight:
  //     Test Files  1 failed (1)
  //          Tests  1 failed | 6 passed (7)
  //
  // 🔴 AND THE INDENTATION BELOW IS LOAD-BEARING. The comment above quotes the real
  // output correctly, WITH its leading spaces — and the first version of the stand-in
  // was typed flush left anyway, three lines under its own evidence. That fixture
  // satisfied a column-0 anchor that real vitest output cannot, so the self-test
  // passed on a shape the world never produces while the harness returned
  // INDETERMINATE for every genuine catch.
  //
  // ⚠️ **A STAND-IN TYPED BY WHOEVER WROTE THE PARSER AGREES WITH THE PARSER BY
  // CONSTRUCTION.** Ward Verifier's clause, and it is the rule now: the fixture a
  // self-test feeds a parser must be captured from the real producer, not typed from
  // memory. Six spaces, because that is what vitest emits — asserted just below so
  // this cannot be quietly tidied back to the left margin.
  const failLine = "FAIL  |node| tests/x.test.ts > d > a name";
  const failSummary = "      Tests  1 failed | 6 passed (7)";
  const greenSummary = "      Tests  7 passed (7)";
  const zeroFailSummary = "      Tests  0 failed | 7 passed (7)";
  check(
    "the self-test's own summary fixtures reproduce vitest's leading indentation",
    [failSummary, greenSummary, zeroFailSummary].every((line) => /^ {6}Tests\b/.test(line)) &&
      ranTests(failSummary) &&
      !/^Tests\b/.test(failSummary)
      ? 0
      : 1,
    0,
  );
  const verdictCase = (label, command, expected) => {
    const run = invokeResult([
      "--file",
      tracked,
      "--find",
      SELF_TEST_ANCHOR,
      "--replace",
      "mutated",
      "--command",
      command,
    ]);
    check(label, run.status, expected);
    if (expected === 1) {
      check(
        `${label} only reports SURVIVED after Guard 3 verified the mutant`,
        /mutant blob.*\(applied\)/u.test(run.stdout ?? "") ? 0 : 1,
        0,
      );
    }
  };

  let exhaustedApplyAttempts = 0;
  let exhaustedApplyCommandRan = false;
  const previousExitCode = process.exitCode;
  runMutation(
    {
      file: tracked,
      find: SELF_TEST_ANCHOR,
      replace: "mutated",
      command: "the command must not run",
    },
    {
      write: (target, bytes, ...writeArgs) => {
        if (typeof bytes === "string") {
          exhaustedApplyAttempts += 1;
          throw Object.assign(new Error("controlled apply refusal"), { code: "UNKNOWN" });
        }
        return writeFileSync(target, bytes, ...writeArgs);
      },
      runCommand: () => {
        exhaustedApplyCommandRan = true;
        return { stdout: "", stderr: "", status: 0 };
      },
    },
  );
  const exhaustedApplyExit = process.exitCode;
  process.exitCode = previousExitCode;
  try {
    ensureTrackedPristine("in-process exhausted-apply control");
  } catch (error) {
    console.error(String(error?.message ?? error));
    failures += 1;
  }
  check(
    "an exhausted mutant write is INDETERMINATE and never runs the command",
    exhaustedApplyExit === INDETERMINATE &&
      exhaustedApplyAttempts === RESTORE_RETRY_DELAYS_MS.length + 1 &&
      !exhaustedApplyCommandRan
      ? 0
      : 1,
    0,
  );

  /*
   * 🔴 THE EMPTY CASE, AND IT WENT RED HERE BEFORE IT WAS A REFUSAL — which is the whole argument
   * for adding self-test cases with the mode rather than after it.
   *
   * I expected guard 3 to catch this: it proves the mutant landed by comparing hashes, and
   * appending nothing should leave the file byte-identical. It does not, because append mode puts
   * the probe on its own LINE, so an empty probe still appends a newline. The hash changed, guard 3
   * was satisfied, the command ran, and a verdict came back about a file carrying no mutant.
   *
   * Now refused at the CLI boundary. The case is retitled to say what it actually tests, rather
   * than left claiming a guard that cannot see it.
   */
  check(
    "APPEND: refuses an empty probe, which would otherwise plant only a newline and pass guard 3",
    invoke(["--file", tracked, "--append", "", "--command", "true"]),
    REFUSED,
  );
  /*
   * ⚠️ THIS PROBE IS INERT ON PURPOSE AND IT IS NOT A TEMPLATE. TWO REASONS, IN THIS ORDER.
   *
   * 🔴 **FIRST, AND IT IS THE ONE I GOT WRONG THE FIRST TIME I WROTE THIS NOTE: "functional" is
   * UNDEFINED for this probe.** The command here is a canned `node -e` that prints a fabricated
   * vitest summary and **never reads the target at all**. Nothing inspects the file, so no probe of
   * any kind could be seen, and the expected `SURVIVED` is correct whatever the payload is. **This
   * case tests VERDICT PASS-THROUGH, not coverage.** My first version explained the survival by
   * saying a comment probe survives any gate that does not read comments — true in general,
   * **false as an account of this case**, and placed exactly where it would be read as one. Ward
   * Builder Three caught it by reading the case rather than my summary of it.
   *
   * **Second, and it is why the payload stays inert rather than being made executable anyway:
   * `tracked` is THIS FILE.** Appending executable JavaScript to the mutation harness's own source
   * means that if a run dies between the write and the restore — **the exact incident this tool was
   * built after, and `finally` does not run on a kill** — the file left on disk is the tool you
   * would use to recover, carrying executable junk. *"The window is milliseconds"* is precisely the
   * argument that was available before the incident that created this harness.
   *
   * **The imitation hazard is real and is labelled rather than removed: copy the shape, not the
   * payload.** A probe that the gate under test cannot see reports `SURVIVED` while proving
   * nothing — but that is a property of the probe-and-gate PAIR, and this case has no gate.
   */
  const appendSurvival = invokeResult([
      "--file",
      tracked,
      "--append",
      "// append-mode self-test probe (inert on purpose — see the note above; do not copy)",
      "--command",
      `node -e "console.log('${greenSummary}')"`,
    ]);
  check(
    "APPEND: an INERT probe still runs, and the verdict is the command's — see the note above",
    appendSurvival.status,
    1,
  );
  check(
    "APPEND: the inert probe only reports SURVIVED after Guard 3 verified it was applied",
    /mutant blob.*\(applied\)/u.test(appendSurvival.stdout ?? "") ? 0 : 1,
    0,
  );

  verdictCase(
    "a red run naming no assertion is CAUGHT, not survived (the dot-reporter shape)",
    `node -e "console.log('${failLine}'); console.log('${failSummary}'); process.exit(1)"`,
    0,
  );
  verdictCase(
    "a green run is still SURVIVED (this was not made to always say caught)",
    `node -e "console.log('${greenSummary}')"`,
    1,
  );
  verdictCase(
    "a reused gate receipt is INDETERMINATE, neither caught nor survived",
    `node -e "console.log('[gate-receipts] REUSED, a reused receipt, not a fresh run')"`,
    INDETERMINATE,
  );

  /**
   * ⚠️ THE INVERSE CASES, AND WARD VERIFIER IS RIGHT THAT THEY ARE THE ONLY ONES
   * THAT DISCRIMINATE.
   *
   * The three cases above assert that a red run is reported CAUGHT. **They pass
   * just as happily on the broken version**, because the broken version said
   * CAUGHT for every non-zero exit. A forward probe cannot separate "reports
   * caught correctly" from "reports caught always" — so it proved nothing about
   * the very property it looked like it was proving.
   *
   * These four fail on the broken version and pass on the fixed one. That is what
   * makes them a test rather than a demonstration.
   */
  verdictCase(
    "INVERSE: a non-zero exit with NO output is INDETERMINATE, not caught",
    `node -e "process.exit(1)"`,
    INDETERMINATE,
  );
  verdictCase(
    "INVERSE: the heavy-run lease marker is INDETERMINATE, not caught",
    `node -e "console.log('DATABASE_HEAVY_RUN_ADMISSION_BUSY'); process.exit(75)"`,
    INDETERMINATE,
  );
  verdictCase(
    "INVERSE: a non-zero exit that collected no tests is INDETERMINATE, not caught",
    `node -e "console.log('${failLine}'); process.exit(1)"`.replace(failLine, "Test Files  1 failed (1)"),
    INDETERMINATE,
  );
  /*
   * THE CASE THAT PROVES THE BROWSER-GATE FIX, rather than only proving nothing broke.
   *
   * A browser gate emits no vitest summary. Before `ranEvidence` this exact shape - non-zero exit,
   * an assertion message, no `Tests` line - was reported INDETERMINATE, i.e. a caught mutant
   * reported as one that never ran. Ward Builder Three hit it on a real production build.
   *
   * The fixture carries an ASSERTION LINE and deliberately not a fabricated Playwright summary:
   * the property under test is "there is evidence a test executed", and an assertion message is
   * that evidence in any runner. Inventing another runner's summary format from memory is the
   * stand-in-typed-by-the-parser-author failure this file has already been caught by once.
   */
  verdictCase(
    "a browser gate with no vitest summary but a real assertion is CAUGHT, not indeterminate",
    `node -e "console.log('AssertionError: the confirmed group no longer carries exactly these columns'); process.exit(1)"`,
    0,
  );

  verdictCase(
    "INVERSE: a green run printing a ZERO-failure summary is SURVIVED, not caught",
    `node -e "console.log('${zeroFailSummary}')"`,
    1,
  );

  rmSync(dir, { recursive: true, force: true });
  console.log(failures === 0 ? "\nself-test: all guards fire" : `\nself-test: ${failures} RED`);
  process.exitCode = failures === 0 ? 0 : 1;
  } finally {
    // Always put the harness file back — even when a mid-suite child exhausted restore retries.
    try {
      ensureTrackedPristine("self-test finally");
    } catch (error) {
      console.error("🔴🔴 SELF-TEST CLEANUP FAILED — A MUTANT MAY BE ON DISK RIGHT NOW.");
      console.error(`     ${error?.message ?? error}`);
      console.error(`     Fix:  git restore ${tracked}`);
      process.exitCode = RESTORE_FAILED;
    }
  }
}

const args = parseArgs(process.argv.slice(2));
if (args["self-test"]) {
  assertAnchorPristine();
  selfTest();
} else if (args.append !== undefined && (args.find !== undefined || args.replace !== undefined)) {
  /*
   * ⚠️ MUTUALLY EXCLUSIVE, REFUSED RATHER THAN RESOLVED BY PRECEDENCE. Given both, this tool would
   * have to pick one — and whichever it picked, the caller would believe the other had happened.
   * A harness that guesses at what you meant is worse than one that stops; that is the same reason
   * Guard 2 refuses an ambiguous anchor instead of taking the first match.
   */
  die(
    REFUSED,
    "REFUSED: --append cannot be combined with --find/--replace.",
    "  They are different mutations and this tool will not choose between them for you.",
  );
} else if (args.append !== undefined && String(args.append).trim() === "") {
  /*
   * 🔴 CAUGHT BY THIS TOOL'S OWN SELF-TEST WHILE APPEND MODE WAS BEING ADDED, WHICH IS THE ONLY
   * REASON IT IS NOT A HOLE. I assumed guard 3 would catch an empty probe: it proves the mutant
   * landed by comparing hashes, and appending nothing should leave the file byte-identical.
   *
   * IT DOES NOT. Append mode writes the probe on its own line, so an empty probe still appends a
   * NEWLINE — the hash changes, guard 3 is satisfied, the command runs, and a verdict comes back
   * about a file carrying no mutant at all. **A pass that means nothing, reported as a result.**
   *
   * ⚠️ That is precisely the "a new mode quietly relaxes a second guard" failure the mode was
   * reviewed against, arriving by accident rather than by design. Refused here at the boundary
   * rather than left to a guard that cannot see it.
   */
  die(
    REFUSED,
    "REFUSED: --append is empty.",
    "  An empty probe still appends a newline, so it would satisfy the mutant-landed check while",
    "  planting nothing — and the verdict would describe an unmutated file.",
  );
} else if (!args.file || !args.command || (args.append === undefined && (!args.find || !args.replace))) {
  die(
    REFUSED,
    "usage: mutation-run.mjs --file <path> --find <literal> --replace <literal> --command <cmd>",
    "       mutation-run.mjs --file <path> --append <literal> --command <cmd>",
    "       mutation-run.mjs --self-test",
    "",
    "  ⚠️ CONFIRM YOUR PROBE IS FUNCTIONAL BEFORE BELIEVING A SURVIVAL. A probe the gate cannot",
    "  see — a comment, say — changes the bytes and mutates nothing, so it reports SURVIVED. And",
    "  because --append always lands at end of file, SURVIVED here means 'no assertion covers a",
    "  probe AT END OF FILE', which is weaker than the find-mode verdict. CAUGHT is unaffected.",
    "",
    "  --append plants a probe at end of file for a sweep-shaped control, where there is no anchor",
    "  to give --find. Only guard 2 is skipped; untracked refusal, proof the mutant landed, restore",
    "  from captured bytes and restore verification all still apply.",
  );
} else {
  runMutation({
    file: args.file,
    find: args.find,
    replace: args.replace,
    append: args.append === undefined ? undefined : String(args.append),
    command: args.command,
  });
}
