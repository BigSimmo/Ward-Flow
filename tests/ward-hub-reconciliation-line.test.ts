import { describe, expect, it } from "vitest";

import { hubReconciliationLine } from "@/components/ward-management/hub/hub-provenance";

/**
 * THE SEARCH HUB'S RECONCILIATION LINE, IN ALL THREE OF ITS FORMS.
 *
 * ⚠️ **TWO OF THE THREE ARE UNREACHABLE FROM THE APP TODAY**, and that is the reason this file
 * exists rather than an argument against it. The shell's shared check array is Phase 1, so the
 * screen can only pass zero until it lands. A disagreeing branch proved only by rendering the
 * screen would therefore be proved by nothing at all, and would sit wrong and green until the
 * day somebody wired it — at which point the line would start lying about figures instead of
 * about nothing.
 *
 * The strings are transcribed from `docs/ward-flow/mockups/search-hub-third-edition.html`, which
 * is the spec. They are not composed from a description of the spec: this screen's trailing clause
 * is `no event feed on this screen`, and an instruction describing the sentence as carrying "the
 * last event" would have produced a sentence claiming an event feed this screen does not have.
 */
describe("the Search hub's reconciliation line", () => {
  const AS_AT = "10:42";

  it("says the figures reconcile when nothing disagrees", () => {
    expect(hubReconciliationLine(0, AS_AT)).toBe(
      "Invented figures, reconciled with each other, as at 10:42, no event feed on this screen",
    );
  });

  it("says how many disagree, singular", () => {
    // ⚠️ THE COMMONER CASE AND THE ONE A TWO-PROBLEM FIXTURE HIDES. "1 figures do not reconcile"
    // is what a plural written as a suffix produces, and it reads as a broken screen rather than
    // as a broken figure.
    expect(hubReconciliationLine(1, AS_AT)).toBe(
      "Invented figures, 1 figure does not reconcile, as at 10:42, no event feed on this screen",
    );
  });

  it("says how many disagree, plural", () => {
    expect(hubReconciliationLine(2, AS_AT)).toBe(
      "Invented figures, 2 figures do not reconcile, as at 10:42, no event feed on this screen",
    );
  });

  it("never claims the figures reconcile once any of them does not", () => {
    // The property, stated separately from the strings above: no count above zero may produce the
    // agreeing wording. This is what a later edit to the formatting would have to break on
    // purpose, and it does not depend on the exact sentence staying the same.
    for (const problems of [1, 2, 3, 17]) {
      expect(hubReconciliationLine(problems, AS_AT)).not.toContain("reconciled with each other");
    }
  });

  it("carries the owner's phrase verbatim in the agreeing form", () => {
    // The owner's words are "Invented figures, reconciled with each other". The clock and trailing
    // clause come from the drawing and wrap them; the PHRASE itself is never paraphrased.
    expect(hubReconciliationLine(0, AS_AT)).toContain("Invented figures, reconciled with each other");
  });

  describe("without a clock — the form this screen actually renders", () => {
    /**
     * 🔴 THE PRODUCTION SHAPE, AND THE ONE AN OPTIONAL PARAMETER HIDES.
     *
     * Ward Lead's rule, 2026-09-10: where a screen already carries an app-side freshness line with
     * the clock, THAT line wins and the sentence renders without its own. The Search hub renders
     * "As at <clock>, Perth" directly above this sentence, so this is the form on the screen — and
     * an optional parameter is only ever wrong when it is OMITTED. A suite that always passed a
     * clock would prove nothing about what a coordinator actually reads.
     */
    it("says the figures reconcile, with no time and no dangling comma", () => {
      expect(hubReconciliationLine(0)).toBe(
        "Invented figures, reconciled with each other, no event feed on this screen",
      );
    });

    it("still counts and still gets the singular right", () => {
      expect(hubReconciliationLine(1)).toBe(
        "Invented figures, 1 figure does not reconcile, no event feed on this screen",
      );
    });

    it("never leaves the words 'as at' behind with nothing after them", () => {
      // The defect a naive template produces: ", as at , no event feed...". It reads as a broken
      // screen rather than as a screen deliberately not repeating the clock above it.
      for (const problems of [0, 1, 4]) {
        expect(hubReconciliationLine(problems)).not.toMatch(/as at\s*,/);
        expect(hubReconciliationLine(problems)).not.toContain("undefined");
      }
    });
  });

  it("never reads Live", () => {
    for (const problems of [0, 1, 5]) {
      expect(hubReconciliationLine(problems, AS_AT)).not.toMatch(/\bLive\b/);
    }
  });
});
