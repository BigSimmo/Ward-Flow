import { describe, expect, it } from "vitest";

import { hubReconciliationLine } from "@/components/ward-management/hub/hub-provenance";
import {
  reconciliationProblems,
  reconciliationSentence,
} from "@/components/ward-management/shell/ward-reconciliation-line";
import type { WardReconciliationCheck } from "@/components/ward-management/shell/ward-shell-types";

/**
 * D-40 — AN EMPTY CHECK ARRAY MUST NEVER CLAIM RECONCILIATION.
 *
 * 🔴 THE DEFECT THIS FILE EXISTS FOR SHIPPED ONCE ALREADY, IN THE SIBLING, AND WAS RULED ON.
 * `ward-bar.tsx` was repaired for exactly this shape — its own comment says "an empty `checks`
 * array is not the same fact as 'every check passed' — it is the fact that nothing was reconciled
 * at all, and this bar must never present the two as identical". The rail's reconciliation line
 * shipped with the same defect, and the bar fix's own test file recorded the rail as "out of this
 * brief's scope". ⚠️ THAT IS A SCOPE LINE, NOT A DESIGN ARGUMENT, and it is what let the rail keep
 * the defect the bar had just had removed.
 *
 * 🔴 AND THE REASON NOTHING CAUGHT IT: EVERY EXISTING TEST PASSED A NON-EMPTY ARRAY.
 * `tests/ward-shell-third-edition.dom.test.tsx` renders the shell with `OK_CHECKS` or
 * `FAILING_CHECKS` and defaults to one of them, so the one array the APP actually passes — `[]`,
 * from `layout.tsx`, on every ward route — was the one array nothing covered. A suite can be large,
 * green and complete over every input except the only one production uses.
 *
 * ⚠️ MEASURED 2026-09-11: nothing under `src/` builds a `WardReconciliationCheck[]`. Until
 * standard §8.7 defines how a screen supplies its checks, the empty case is not an edge case — it
 * is the ONLY case, and the two agreeing branches below are unreachable in the running app. That
 * inverts the usual priority: these assertions guard production, and the others guard the future.
 *
 * THE POPULATION: both shell surfaces that render a reconciliation sentence — the rail's
 * `reconciliationSentence` and the Search hub's `hubReconciliationLine`. If a third appears, it
 * belongs here. The anti-vacuity floor below fails if this file is ever reduced to one.
 */

/*
 * ⚠️ `WardReconciliationCheck` is `{ label, ok }` — there is no `id`. This file was written with
 * one and the VITEST RUN STAYED GREEN, because the runner does not typecheck; only
 * `tsc -p tsconfig.typecheck.json --noEmit` saw it. A test whose fixture does not match the type
 * it claims is a test about a shape the app cannot produce.
 */
const OK: WardReconciliationCheck[] = [{ label: "Beds", ok: true }];
const BAD: WardReconciliationCheck[] = [{ label: "Beds", ok: false }];

/** The exact phrase that must never appear over an empty population, on either surface. */
const AGREEMENT = "reconciled with each other";

describe("D-40: an empty check array never claims reconciliation", () => {
  it("covers both shell surfaces that compose a reconciliation sentence", () => {
    /*
     * An anti-vacuity floor on the POPULATION, not on the assertions. A later edit that deletes
     * one surface's cases leaves the other's green and this file still passing — this is the check
     * that notices. It fails closed: if either import stops being a function, it goes red here
     * rather than silently testing one thing twice.
     */
    expect(typeof reconciliationSentence, "the rail's sentence composer is gone from this suite").toBe("function");
    expect(typeof hubReconciliationLine, "the hub's sentence composer is gone from this suite").toBe("function");
  });

  /**
   * 🔴 **O-9, 2026-09-12 — D-40's PROPERTY IS UNCHANGED AND ITS POPULATION HAS GROWN BY ONE.**
   *
   * **D-40 ruled that an empty check array must never claim reconciliation.** ⚠️ **It fixed what an
   * empty array MEANS when rendered, and not the plumbing: until O-9 nothing in this codebase could
   * tell A SCREEN PUBLISHED ZERO CHECKS from NO SCREEN HAS PUBLISHED ANYTHING. Both were `[]`.**
   *
   * ✅ **So this suite now drives a UNION, and the guard is STRICTLY STRONGER than the one it
   * replaces: neither absent state may claim agreement, and they must not be the same sentence.**
   * 🔴 **A test expectation is a ruling — this one changed under Ward Lead's explicit instruction to
   * build O-9, and D-40 is honoured rather than relaxed. If either assertion below is ever weakened
   * to make a screen pass, that is the defect D-40 exists for coming back.**
   */
  const NOTHING_PUBLISHED = { published: false } as const;
  const PUBLISHED_EMPTY = { published: true, checks: [] } as const;

  describe("the rail line", () => {
    it("keeps 'nobody published' and 'published nothing' as two different sentences", () => {
      const silent = reconciliationSentence(NOTHING_PUBLISHED);
      const looked = reconciliationSentence(PUBLISHED_EMPTY);

      expect(silent, "the unpublished state claims agreement").not.toContain(AGREEMENT);
      expect(looked, "a screen reporting nothing to reconcile claims agreement").not.toContain(AGREEMENT);
      expect(
        looked,
        "a screen that LOOKED and found nothing says the same words as a screen that has not spoken " +
          "— which is the collapse the union exists to prevent, and it would be invisible on screen",
      ).not.toBe(silent);
    });

    it("says nothing was reconciled, and does NOT claim agreement", () => {
      const sentence = reconciliationSentence(NOTHING_PUBLISHED);
      expect(sentence).toBe("No reconciliation is available for this page yet.");
      expect(
        sentence,
        "an empty array produced the agreeing sentence — this is the defect D-40 closed, and it " +
          "was visible as plain text in the open rail on every ward route",
      ).not.toContain(AGREEMENT);
    });

    it("drops the clock, because nothing was compared at that time", () => {
      /*
       * ⚠️ A CLOCK READING SAYS WHEN FIGURES WERE COMPARED. Appending ", as at 09:42." to a
       * sentence about a comparison that never happened attaches a timestamp to a measurement that
       * does not exist — a smaller falsehood than the agreement, and a harder one to spot, because
       * a time reads as evidence of work.
       */
      expect(reconciliationSentence(NOTHING_PUBLISHED, "09:42")).toBe(
        "No reconciliation is available for this page yet.",
      );
      expect(reconciliationSentence(NOTHING_PUBLISHED, "09:42")).not.toContain("09:42");
      expect(reconciliationSentence(PUBLISHED_EMPTY, "09:42")).not.toContain("09:42");
    });

    it("still carries the clock when a real check ran", () => {
      // The mirror. Without this, dropping `asAt` unconditionally would pass every assertion above.
      expect(reconciliationSentence({ published: true, checks: OK }, "09:42")).toBe(
        "Invented figures, reconciled with each other, as at 09:42.",
      );
    });

    it("still reports a real failure, and a real pass", () => {
      expect(reconciliationSentence({ published: true, checks: BAD })).toBe(
        "Invented figures, 1 figure does not reconcile.",
      );
      expect(reconciliationSentence({ published: true, checks: OK })).toBe(
        "Invented figures, reconciled with each other.",
      );
    });

    it("reports no problems for an empty array, which is why the count alone could never decide it", () => {
      /*
       * 🔴 THE MECHANISM, PINNED. `reconciliationProblems([])` is `[]`, so `problems.length === 0`
       * is TRUE for "everything passed" and TRUE for "nothing ran". The old code branched on that
       * number alone, which is why it could not tell the two apart. Anything that reintroduces a
       * length-only branch reintroduces the defect.
       */
      expect(reconciliationProblems([])).toHaveLength(0);
      expect(reconciliationProblems(OK)).toHaveLength(0);
      expect(reconciliationProblems(BAD)).toHaveLength(1);
    });
  });

  describe("the Search hub line", () => {
    it("says nothing was reconciled when passed null, and does NOT claim agreement", () => {
      const sentence = hubReconciliationLine(null);
      expect(sentence).toBe("No reconciliation is available for this page yet, no event feed on this screen");
      expect(
        sentence,
        "the hub printed the agreeing sentence from a hardcoded zero, so /mockups/ward-flow/hub " +
          "carried TWO agreeing sentences over zero checks — its own and the rail's",
      ).not.toContain(AGREEMENT);
    });

    it("keeps the fact that is still true about this screen", () => {
      // The suffix is a real property of the Search hub and survives the state change.
      expect(hubReconciliationLine(null)).toContain("no event feed on this screen");
    });

    it("keeps both original branches, which the screen's own note instructs", () => {
      expect(hubReconciliationLine(0)).toBe(
        "Invented figures, reconciled with each other, no event feed on this screen",
      );
      expect(hubReconciliationLine(2)).toBe(
        "Invented figures, 2 figures do not reconcile, no event feed on this screen",
      );
      expect(hubReconciliationLine(1)).toContain("1 figure does not reconcile");
    });
  });

  it("the two surfaces agree about the empty state, without sharing a string", () => {
    /*
     * ⚠️ NOT A STRING-EQUALITY CHECK. The hub's sentence carries a fact the rail's does not, so
     * they are deliberately different sentences. What must hold across both is the PROPERTY:
     * neither asserts agreement when nothing was checked. Pinning equality would force one screen
     * to drop a true statement to satisfy a test.
     */
    for (const sentence of [reconciliationSentence(NOTHING_PUBLISHED), hubReconciliationLine(null)]) {
      expect(sentence).not.toContain(AGREEMENT);
      expect(sentence).toContain("No reconciliation is available for this page yet");
    }
  });
});
