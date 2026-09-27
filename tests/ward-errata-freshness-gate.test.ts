import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 🔴 **THIS GATE WAS WRITTEN AND INVOKED BY NOTHING.**
 *
 * `scripts/ward-flow/check-errata-freshness.mjs` re-measures every factual claim in
 * `docs/ward-flow/plans/2026-09-10-master-plan-errata.md` against the current tree, so a lane never
 * acts on a claim that has since gone stale. No `npm run` script, test, or CI job called it. This
 * file is the caller, the same shape as `tests/ward-text-size-ratchet.test.ts` for its sibling gate.
 *
 * ## What this pins, and what it deliberately does not
 *
 * ✅ That the gate RUNS and passes on the current tree, so it cannot quietly rot back to unreachable.
 *
 * 🔴 **That it actually measured something.** The script's population is the hard-coded `CLAIMS`
 * array, walked with a plain `for...of`. If that array were ever emptied — every entry closed and
 * removed, or a bad edit truncated it — the loop iterates zero times, `expired` stays `0`, and the
 * script prints "All entries still hold as measured." and exits 0. **A file that measures nothing
 * currently reads identically, to the script, as a file where every claim was re-verified.** This
 * test adds the floor the script does not have, at the wiring layer, by counting the individual
 * verdict lines the script itself prints (`STILL TRUE` / `CLOSED, still resolved` / `EXPIRED`)
 * rather than trusting the closing summary sentence alone.
 *
 * ⚠️ Some individual claims (e.g. "I", the drawings' `&rsquo;` usage) already carry their own
 * `n > 0` style floor inside their own `check()`, so THEIR narrower population is protected without
 * help. The gap this test closes is the outer one: the CLAIMS array itself, which nothing inside the
 * script checks the size of.
 */

const REPO = process.cwd();
const SCRIPT = join(REPO, "scripts/ward-flow/check-errata-freshness.mjs");

function runGate(): { status: number; output: string } {
  try {
    const output = execFileSync(process.execPath, [SCRIPT], { cwd: REPO, encoding: "utf8" });
    return { status: 0, output };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { status: failure.status ?? -1, output: `${failure.stdout ?? ""}${failure.stderr ?? ""}` };
  }
}

describe("the ward errata-freshness gate is reachable and still measures something", () => {
  it("🔴 runs at all — the defect this file exists for was that nothing invoked it", () => {
    const { status, output } = runGate();
    expect(status, `the gate exited ${status}, expected 0 on a fresh errata sheet. Output:\n${output}`).toBe(0);
    expect(output, "the gate ran but did not report the expected all-clear sentence").toContain(
      "All entries still hold as measured.",
    );
  });

  /**
   * 🔴 **THE FLOOR, ADDED HERE BECAUSE THE SCRIPT DOES NOT HAVE ONE.**
   *
   * The closing "All entries still hold as measured." line is printed whenever `expired === 0`,
   * which is also true when the CLAIMS array is empty and nothing was ever measured. Counting the
   * individual per-claim verdict lines is what makes an empty population visible.
   */
  it("🔴 reports more than a handful of individually measured claims, not zero", () => {
    const { output } = runGate();
    const verdictLines = output.match(/^\s*(STILL TRUE|CLOSED, still resolved|🔴 EXPIRED)\s/gmu) ?? [];
    expect(
      verdictLines.length,
      `the gate printed only ${verdictLines.length} per-claim verdict(s). An emptied CLAIMS array ` +
        "would print zero of these while still exiting 0 and saying 'All entries still hold as " +
        "measured' - see this test file's header for why that is a real, unfixed gap in the script.",
    ).toBeGreaterThan(5);
  });

  it("🔴 reports the repo and head it measured against, so a stale checkout is visible", () => {
    const { output } = runGate();
    expect(output).toMatch(/repo\s+\S+/u);
    expect(output).toMatch(/head\s+[0-9a-f]{10}/u);
  });
});
