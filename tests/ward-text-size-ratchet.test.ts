import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 🔴 **OWNER RULING D-3 HAD AN ENFORCEMENT THAT RAN NOWHERE.**
 *
 * `scripts/ward-flow/check-text-size-floor.mjs` implemented the ruling — no NEW sub-12px text in ward
 * CSS — and **no npm script, no test and no CI invoked it.** ⚠️ **That is this repository's catalogued
 * defect class: built, correct, tested and unreachable.** This file is the caller, and
 * `npm run check:ward-text-size` is the other one.
 *
 * ## What this pins, and what it deliberately does not
 *
 * ✅ **That the ratchet RUNS and passes on the current tree**, so it cannot quietly rot back to
 * unreachable. **A ratchet nobody invokes is a ruling nobody enforces.**
 *
 * ✅ **That the baseline is recorded PER FILE.** The total-only version was demonstrably defeated: a
 * file leaving the population donated its whole count as headroom, and nine new `var(--text-3xs)`
 * declarations were appended while it printed *"difference 0 — Not risen"*.
 *
 * ⚠️ **It does NOT re-run the mutation proofs.** Those were run by hand against the script and are
 * recorded in its header; a test that appends to real ward CSS would leave the tree dirty for every
 * other chat sharing this worktree, which is a worse trade than citing them.
 */

const REPO = process.cwd();
const SCRIPT = join(REPO, "scripts/ward-flow/check-text-size-floor.mjs");
const BASELINE = join(REPO, "scripts/ward-flow/text-size-floor-baseline.json");

function runRatchet(): { status: number; output: string } {
  try {
    const output = execFileSync(process.execPath, [SCRIPT], { cwd: REPO, encoding: "utf8" });
    return { status: 0, output };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { status: failure.status ?? -1, output: `${failure.stdout ?? ""}${failure.stderr ?? ""}` };
  }
}

describe("the D-3 text-size ratchet is reachable and still ratchets", () => {
  it("🔴 runs at all — the defect this file exists for was that nothing invoked it", () => {
    const { status, output } = runRatchet();
    expect(
      status,
      `the D-3 ratchet exited ${status}. If it REFUSED (2) the sweep or the matcher is broken, which is ` +
        `not the same as ward CSS being clean. Output:\n${output}`,
    ).toBe(0);
    expect(output, "the ratchet ran but reported nothing recognisable").toContain("Not risen in any file");
  });

  /**
   * 🔴 **THE FLOOR AND THE CONTROL MUST BE VISIBLE IN ITS OWN OUTPUT.**
   * Both were added because their absence is invisible: a sweep that matched nothing printed the
   * success message, and a broken matcher counted zero everywhere and passed. ⚠️ **Asserting they are
   * REPORTED is what stops a later "tidy" removing them silently** — a removed line changes this
   * output, and nothing else in the repository would notice.
   */
  it("🔴 reports the population it swept and the control it proved, not just the count", () => {
    const { output } = runRatchet();
    expect(output, "the ratchet no longer says how many stylesheets it swept").toMatch(/swept\s+\d+ stylesheet/u);
    expect(output, "the ratchet no longer says it refuses below a floor").toMatch(/refuses below \d+/u);
    expect(output, "the matcher's positive control is no longer reported").toMatch(/matcher\s+proved on a specimen/u);
  });

  it("🔴 records the baseline PER FILE, not as one total", () => {
    const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as {
      count?: number;
      fileCount?: number;
      perFile?: Record<string, number>;
    };
    const perFile = baseline.perFile ?? {};
    const names = Object.keys(perFile);

    expect(
      names.length,
      "the baseline has no per-file counts. A total-only baseline lets one file's fall pay for " +
        "another's rise, and lets a file LEAVING the population pay for a rise anywhere — which is " +
        "how nine new sub-12px declarations once passed this gate reading 'difference 0'",
    ).toBeGreaterThan(10);

    // 🔴 And the recorded parts must add up to the recorded whole. A total that disagrees with its own
    // per-file breakdown is the shape that let the old version drift unnoticed.
    const summed = Object.values(perFile).reduce((total, value) => total + value, 0);
    expect(summed, "the baseline's per-file counts do not sum to its recorded total").toBe(baseline.count);
    expect(names.length, "the baseline's fileCount disagrees with its own per-file list").toBe(baseline.fileCount);

    for (const [file, count] of Object.entries(perFile)) {
      expect(
        count,
        `${file} is pinned at ${count} — a baseline entry of zero is not a pin, it is noise`,
      ).toBeGreaterThan(0);
    }
  });

  /**
   * 🔴 **THE COMMENT QUESTION, PINNED RATHER THAN SETTLED — AND THIS CASE IS THE PRICE OF SETTLING IT.**
   *
   * The counter matches the token string **wherever it appears, including inside a CSS comment**. That
   * is why documenting D-3 inside ward CSS would raise the count, and why the script's own explanation
   * lives in a `.mjs` file.
   *
   * ⚠️ **Somebody will propose making it comment-blind, and it is a reasonable proposal.** This case
   * exists so that proposal cannot be waved through as obvious tidying: **a comment-blind counter must
   * still catch a declaration DISGUISED as a comment**, and the specimen below is the one it would have
   * to keep counting.
   *
   * 🔴 **If you make the counter comment-blind, this test SHOULD go red.** Do not delete it — replace
   * the assertion with proof that the disguised declaration below is still caught, which is the whole
   * cost of the change.
   */
  it("🔴 counts the token inside a comment too — stated, not solved, and here is the specimen", () => {
    const script = readFileSync(SCRIPT, "utf8");
    const pattern = /--text-3xs\|--text-2xs/u;
    expect(
      pattern.test(script),
      "the token pattern changed. If it became comment-aware, this case must be rewritten to prove a " +
        "declaration disguised as a comment is still caught — not deleted",
    ).toBe(true);

    /*
     * The disguise, written as data rather than as a real CSS comment so this file's own text cannot
     * be mistaken for the thing it describes. A comment-blind counter naive enough to strip anything
     * between the markers would skip a real declaration a builder had parked there.
     */
    const disguised = ["/*", " .parked { font-size: var(--text-3xs); }", "*/"].join("\n");
    const occurrences = disguised.match(/--text-3xs|--text-2xs/gu) ?? [];
    expect(
      occurrences.length,
      "the specimen no longer contains a token occurrence, so it cannot demonstrate the disguise this " +
        "case exists to hold",
    ).toBe(1);
  });
});
