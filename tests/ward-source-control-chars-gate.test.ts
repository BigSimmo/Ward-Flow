import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 🔴 **THIS GATE WAS WRITTEN AND INVOKED BY NOTHING.**
 *
 * `scripts/ward-flow/check-source-control-chars.mjs` guards against the 2026-09-10 incident where
 * two literal NUL bytes were committed inside a template literal — invisible to tests, `tsc`,
 * Prettier, review and even `git diff --numstat`. The script existed, was correct on the day it was
 * written, and **no `npm run` script, test, or CI job called it.** This file is the caller, the same
 * shape as `tests/ward-text-size-ratchet.test.ts` for its sibling gate.
 *
 * ## What this pins, and what it deliberately does not
 *
 * ✅ That the gate RUNS and passes on the current tree, so it cannot quietly rot back to unreachable.
 *
 * 🔴 **That the reported population is not near zero.** The script itself has NO floor on its own
 * walk: `ROOTS = ["src", "tests"]` is walked, and if that walk ever returned zero files — a moved
 * directory, a typo'd root, a broken glob — the script's own logic still prints "None found." and
 * exits 0, because an empty `files` array produces an empty `offences` array. **A scan of nothing
 * currently reads identically to a clean tree, both to the script and to a test that only checks its
 * exit code.** This test adds the floor the script does not have, at the wiring layer, without
 * touching the script's own pass/fail logic (that decision belongs to whoever owns the script).
 *
 * ⚠️ This test does NOT re-run the exemption or the C0-vs-permitted boundary logic; that overlaps
 * with `tests/source-control-bytes.test.ts`, which already scans the whole repository (all tracked
 * AND untracked text files, not just `src/` and `tests/`) for the same defect class and is already
 * wired into the ordinary test suite. This gate's population is a strict subset of that one's. Both
 * are wired here rather than choosing one, because retiring either is a decision for whoever owns
 * them, not a side effect of a wiring task.
 *
 * 🔴 2026-09-12 ADDITION — THE TOTAL FLOOR ABOVE CANNOT CATCH A ROOT GOING BLIND.
 *
 * The script's `ROOTS` gained a third entry, `docs/ward-flow`, after five raw BACKSPACE bytes sat
 * in three tracked `.md` files there for days while this gate scanned only `src/` and `tests/` and
 * reported "None found." throughout — see the script's own header for the incident. The trap named
 * in this file's title line ("reports a population that is not near zero") is exactly the trap that
 * incident exposed one level up: the TOTAL floor (>1000) is satisfied by `src/` and `tests/` alone,
 * with or without `docs/ward-flow` being walked at all — so widening `ROOTS` would make that floor
 * easier to satisfy, never harder, and a regression that silently dropped `docs/ward-flow` again
 * would sail past it unnoticed. The test below adds a SEPARATE floor over the docs population by
 * name, so that a docs-specific regression is visible even while the total floor stays green.
 */

const REPO = process.cwd();
const SCRIPT = join(REPO, "scripts/ward-flow/check-source-control-chars.mjs");

function runGate(): { status: number; output: string } {
  try {
    const output = execFileSync(process.execPath, [SCRIPT], { cwd: REPO, encoding: "utf8" });
    return { status: 0, output };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { status: failure.status ?? -1, output: `${failure.stdout ?? ""}${failure.stderr ?? ""}` };
  }
}

describe("the ward source-control-character gate is reachable and still guards", () => {
  it("🔴 runs at all — the defect this file exists for was that nothing invoked it", () => {
    const { status, output } = runGate();
    expect(status, `the gate exited ${status}, expected 0 on a clean tree. Output:\n${output}`).toBe(0);
    expect(output, "the gate ran but did not report a clean result").toContain("None found.");
  });

  /**
   * 🔴 **THE FLOOR, ADDED HERE BECAUSE THE SCRIPT DOES NOT HAVE ONE.**
   *
   * `expect(status).toBe(0)` above is satisfied by a walk that finds NOTHING, which is exactly the
   * failure class this whole task exists to guard against — see the module note. This assertion is
   * what makes that specific breakage visible: it names the count, not just the verdict.
   */
  it("🔴 reports a population that is not near zero — a scan of nothing must not read as clean", () => {
    const { output } = runGate();
    const match = output.match(/Scanned (\d+) source files under/);
    expect(match, "the gate no longer prints how many files it scanned — cannot check the floor").not.toBeNull();
    const scanned = match ? Number(match[1]) : 0;
    expect(
      scanned,
      `the gate scanned only ${scanned} file(s). Its own pass/fail logic treats this identically to a ` +
        "clean tree - see this test file's header for why that is a real, unfixed gap in the script.",
    ).toBeGreaterThan(1000);
  });

  it("🔴 reports its exemption list by name, not silently — a skip list nobody can read is where corruption hides", () => {
    const { output } = runGate();
    expect(output).toContain("docs/ward-flow/lessons/corruption-that-makes-checks-pass-harder.md");
    expect(output).toMatch(/\d+ file\(s\) exempted/);
  });

  /**
   * 🔴 **THE DOCS-SPECIFIC FLOOR — see the module header for why the total floor above cannot do
   * this job.** `ROOTS` including `docs/ward-flow` is necessary but not sufficient; if a future edit
   * silently dropped that root (a typo'd path, a reverted merge, a re-narrowed extension list that
   * matches nothing there), `src/` and `tests/` alone still clear 1000 files and the test above would
   * stay green while the exact blind spot that caused the 2026-09-12 incident came back. This
   * assertion names the docs population on its own, independent of the total.
   */
  it("🔴 reports a docs/ward-flow population that is not near zero — the root most recently found blind", () => {
    const { output } = runGate();
    const match = output.match(/docs\/ward-flow:\s*(\d+) file\(s\) scanned/);
    expect(
      match,
      "the gate no longer prints a per-root docs/ward-flow scanned count — cannot check the floor. " +
        "Output:\n" +
        output,
    ).not.toBeNull();
    const scanned = match ? Number(match[1]) : 0;
    expect(
      scanned,
      `the gate scanned only ${scanned} file(s) under docs/ward-flow. There are roughly 715 tracked ` +
        "files there (minus a handful of explicitly skipped binaries, oversized captures and .log " +
        "captures — see the script's SKIP_BINARY_EXTENSIONS / LOG_SKIP_REASON), so a count anywhere " +
        "near zero means the root that caused the 2026-09-12 incident has gone blind again.",
    ).toBeGreaterThan(500);
  });
});
