import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ═══ NO FILE CONTAINS ITSELF — THE CORRUPTION THAT PASSES MORE, NOT LESS ═══
 *
 * 🔴 **ON 2026-09-06 A TEST FILE IN A SIBLING WORKTREE WENT FROM 367 LINES TO 1101** — its own
 * content appended twice over, three byte-identical copies, and **of the added lines not one was
 * absent from HEAD.** Nothing was lost, so nothing failed.
 *
 * ⚠️ **IT DOES NOT GO RED. IT PASSES, THREE TIMES OVER.** Every count quoted from that run inflates
 * — suite totals, per-file test counts, anything anybody puts in a commit message — and no
 * assertion anywhere says so, because passing a test three times is not an error. It was found only
 * because an unrelated pre-commit hook blocked for half an hour.
 *
 * ⚠️ **THIS IS A DUPLICATION DETECTOR AND ONLY THAT.** `check:diff-integrity` holds the other half:
 * a FLOOR on test-case counts, which catches deletion and truncation. **A floor has no ceiling —
 * that is precisely why this case was missing.** Neither guard subsumes the other and neither
 * should be widened to try.
 *
 * ⚠️ **THE PREMISE WAS MEASURED BEFORE THIS WAS WRITTEN, NOT ASSUMED.** A naive duplicate-detector
 * fires on correct work: a sibling chat's stylesheet version found 18 of 51 files legitimately
 * repeating a top-level selector. A file's OPENING is different — measured across 5,877 files in
 * `src/`, `tests/`, `docs/` and `scripts/`, **not one legitimately repeats its own first 300
 * characters.** The self-test below re-establishes the detector's behaviour on every run; this
 * paragraph records the population the premise was checked against.
 */

const ROOTS = ["src", "tests", "docs"];
const EXTENSIONS = /\.(ts|tsx|css|html|md|mjs|json)$/;
const SKIP_DIR = /node_modules|\.next|\.git|coverage/;

/** Long enough that a genuine opening is unique; short enough that few files are excluded. */
const NEEDLE = 300;
/**
 * A file shorter than the needle is checked on its whole content instead — but only above this
 * floor. Below it a file can legitimately be a repeated fragment (a two-line barrel export, a stub),
 * and the skipped count is REPORTED rather than left silent, so the excluded population is visible.
 */
const MIN_WHOLE_FILE = 120;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (SKIP_DIR.test(p)) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXTENSIONS.test(entry)) out.push(p);
  }
  return out;
}

/**
 * How many times the file's own opening appears in it. **1 is correct. 2+ is a self-append. 0 is
 * impossible for a non-empty file and therefore means the detector itself is broken** — which is
 * why the self-test asserts all three rather than only the bad case.
 */
export function selfCopyCount(content: string): number {
  const needle = content.length >= NEEDLE ? content.slice(0, NEEDLE) : content;
  if (needle.length === 0) return 0;
  return content.split(needle).length - 1;
}

describe("no file in this repository contains its own opening twice", () => {
  it("⚠️ the detector reads 1 for clean, 3 for tripled, 0 for empty — proved both directions", () => {
    /*
     * 🔴 **A CLEAN RESULT IS EXACTLY WHAT A BROKEN PROBE RETURNS.** Asserting only that real files
     * come back clean would pass against a detector that always returns 1, always returns 0, or
     * never runs. Known-good AND known-bad input, every run, in memory — no fixture on disk to rot.
     */
    const clean = `${"// a realistic opening line that is long enough to be a unique needle\n".repeat(6)}body {}\n`;
    expect(clean.length).toBeGreaterThan(NEEDLE);

    expect(selfCopyCount(clean), "a clean file must read 1").toBe(1);
    expect(selfCopyCount(clean + clean), "a doubled file must read 2").toBe(2);
    expect(selfCopyCount(clean + clean + clean), "a tripled file must read 3").toBe(3);
    expect(selfCopyCount(""), "an empty file must read 0, not 1").toBe(0);
    // Truncation is the OTHER guard's job, and this one must not pretend to catch it: a truncated
    // file still contains its own opening exactly once and is correctly reported clean here.
    expect(selfCopyCount(clean.slice(0, 400)), "truncation is not this detector's finding").toBe(1);
  });

  it("🔴 finds no self-appended file, and reports the population it walked", () => {
    const files = ROOTS.flatMap((root) => walk(root));
    const checked: string[] = [];
    const skippedTooShort: string[] = [];
    const offenders: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      if (content.length < MIN_WHOLE_FILE) {
        skippedTooShort.push(file);
        continue;
      }
      checked.push(file);
      const n = selfCopyCount(content);
      if (n > 1) offenders.push(`${file}: its own opening appears ${n} times`);
    }

    /*
     * ⚠️ **THE FLOOR IS ON THE POPULATION WALKED, NEVER ON THE FINDING.** If the walk breaks — a
     * renamed directory, an extension dropped from the pattern — every assertion below ranges over
     * nothing and reports a clean repository. That reads identically to a repository with no
     * corruption in it.
     */
    expect(files.length, "the walk found almost nothing; the roots or extensions have changed").toBeGreaterThan(2_000);
    expect(checked.length, "nothing was checked").toBeGreaterThan(2_000);
    // The excluded set is visible rather than silent. If this grows sharply, the exclusion is doing
    // more work than it was given.
    expect(skippedTooShort.length, `files under ${MIN_WHOLE_FILE} chars were skipped`).toBeLessThan(checked.length / 4);

    expect(
      offenders,
      "a file contains its own opening more than once — it has been appended to itself. This does " +
        "not fail any other test: a duplicated test file PASSES, once per copy, and inflates every " +
        "count taken from that run.",
    ).toEqual([]);
  });
});
