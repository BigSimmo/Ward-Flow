import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * THE TRANSPORT PAGE HAS ONE NAME.
 *
 * `HD-Q1`, answered by the owner 2026-08-30: the page is called **Transport**. Until then it had
 * three user-facing names and they all disagreed:
 *
 *   the route            /mockups/ward-flow/transport
 *   the document title   "Live tracker - Ward Flow"
 *   the page heading     <h1 class="sr-only">Live tracker</h1>
 *
 * ⚠️ **THE HEADING IS THE ONE THAT MATTERS MOST AND IS THE EASIEST TO LEAVE BEHIND.** It is
 * `sr-only`, so nobody reviewing the screen visually ever sees it — and it is the page's accessible
 * name, which means for a screen-reader user it is not one name among three, it is **the only one
 * they get.** A sighted reader can reconcile a tab title against a nav label; somebody hearing
 * "Live tracker" announced on a page the nav called Transport has nothing to reconcile it against.
 *
 * The component and its file stay `LiveTracker` / `live-tracker.tsx`. That name is internal, no
 * user meets it, and renaming it would move every import for no reader's benefit — the opposite
 * trade from `/patients/[patientId]` (since moved to `/movements/[movementId]`), where the ROUTE
 * lied about what the page showed and a user does meet it.
 */
const PAGE = "src/app/mockups/ward-flow/transport/page.tsx";
const COMPONENT = "src/components/ward-management/tracker/live-tracker.tsx";
/** Where the transport content lives after MERGE 03, and therefore where the name must now match. */
const MERGED = "src/components/ward-management/movements/movements-screen.tsx";

describe("the transport page names itself the same way everywhere a user can hear it", () => {
  const page = readFileSync(PAGE, "utf8");
  const component = readFileSync(COMPONENT, "utf8");
  const merged = readFileSync(MERGED, "utf8");

  it("reads every file, or every assertion below is about an empty string", () => {
    // The canary. `.not.toContain` on a file that failed to load passes perfectly.
    expect(page.length).toBeGreaterThan(100);
    expect(component.length).toBeGreaterThan(100);
    expect(merged.length).toBeGreaterThan(100);
    expect(component).toContain("sr-only");
  });

  /**
   * 🔴 **THE PAGE BECAME A REDIRECT, SO THE NAME MOVED RATHER THAN STOPPED MATTERING.**
   *
   * MERGE 03 folded `/transport` into `/movements`. This file used to assert the transport PAGE
   * titled itself "Transport"; there is no longer a transport page for anyone to land on, so that
   * assertion had nothing left to protect and would have been deleted in a tidy-up — **taking the
   * accessibility rule with it.**
   *
   * The rule survives because the reason survives: owner ruling HD-Q1 says the name a screen reader
   * announces must match the name the navigation gives. Transport content now lives on Movements,
   * so that is where the property is checked.
   */
  it("sends /transport to /movements, so nobody can land on a page with a name nobody maintains", () => {
    expect(page).toContain("redirect(");
    expect(page).toContain("/mockups/ward-flow/movements");
  });

  it("⚠️ HEADS THE MERGED PAGE Movements — the name a screen reader gets, matching the nav label", () => {
    expect(merged).toMatch(/<h1[^>]*>[\s\S]*?Movements\s*<\/h1>/u);
  });

  it("⚠️ HEADS THE PAGE Transport — the accessible name, and the only one a screen reader gets", () => {
    expect(component).toContain('<h1 className="sr-only">Transport</h1>');
  });

  it("says Live tracker nowhere a user can reach", () => {
    // ⚠️ COMMENTS ARE STRIPPED FIRST, and the first version of this test did not strip them — so it
    // failed on the comment explaining the rename, which says "Live tracker" in order to record what
    // the heading used to be. Same shape as a retraction that quotes the claim it withdraws: the
    // search matched the word and not the thing. A comment is not somewhere a user can reach, and a
    // test that forbids naming the old name in prose would make the history unwritable.
    const reachable = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

    expect(
      reachable(page),
      "the old name survives in the page's metadata, which a browser tab and a search result show",
    ).not.toMatch(/Live tracker/);
    expect(
      reachable(component),
      "the old name survives in the component's rendered output — a heading, a subtitle or an " +
        "aria-label, each of which reaches somebody",
    ).not.toMatch(/Live tracker/);
  });

  it("STRIPS ONLY COMMENTS — the stripper must not be eating the code it is meant to search", () => {
    /**
     * The canary for the assertion above. A stripper with a greedy or wrong pattern returns
     * something short and harmless, and `.not.toMatch` then passes against nearly nothing.
     *
     * 🔴 **THIS CANARY USED TO ASSERT `stripped.length > component.length / 2`, AND THAT MEASURED
     * COMMENT DENSITY RATHER THAN THE STRIPPER.** It went red on 2026-09-06 without the stripper
     * changing at all: the retirement marker at the top of `live-tracker.tsx` took the file to 53%
     * comments, so a correct stripper returned less than half and the failure announced "the
     * stripper removed most of the file" — naming the wrong culprit, in the one place somebody
     * debugging would trust it.
     *
     * ⚠️ **A PROPORTION CANNOT DISTINGUISH A GREEDY STRIPPER FROM A WELL-COMMENTED FILE**, and this
     * repository asks every one of these files to carry its reasoning in prose. The canary was
     * therefore calibrated to go red on the house style. It is not loosened below — that would
     * disarm it — but restated as what it always meant: **the code survives stripping.**
     *
     * The landmarks are hard-coded rather than derived, and they span the file deliberately. A
     * greedy `[\s\S]*` eats from the first block-comment opener to the last closer, which here is line 3 to line 101
     * — so a landmark above the body and one below it are what catch it, and the heading alone
     * would not. They are literal strings so they cannot share a bug with the stripper they test.
     */
    const reachable = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const stripped = reachable(component);

    /*
     * ⚠️ **THE LANDMARKS ARE CHOSEN AGAINST TWO DIFFERENT FAULTS, AND NEITHER SET CATCHES BOTH.**
     * Ward Verifier and I repaired this canary independently within the same hour and picked
     * different landmarks; this is the union, with the reason each one is here.
     *
     *   line 22   import Link            above the body, below the first comment opener
     *   line 78   export function        \  the two a GREEDY match eats: it runs from the
     *   (line 3 -> line 101 is the span) /   first opener to the LAST closer, so it takes the middle
     *   line 102  the <h1>               survives a greedy match — it sits just past the last closer
     *   line 175  </main>                the last code in the file: what a TRUNCATING stripper loses
     *
     * 🔴 **The h1 is the one that reads like the real check and it is the weakest.** A greedy
     * stripper leaves it standing — measured, output began `'"use client";

}
        <h1 class…'`.
     * Verifier proved their repair with a `.slice(0, 200)` truncation, which is a different and
     * milder fault than the one this guards, and said so. Keep all four: a landmark only proves the
     * fault shape that can actually remove it.
     */
    for (const landmark of [
      'import Link from "next/link";',
      "export function LiveTracker() {",
      '<h1 className="sr-only">Transport</h1>',
      "</main>",
    ]) {
      expect(
        stripped,
        `the stripper ate code: ${landmark} did not survive, so the search above is looking at less than the file`,
      ).toContain(landmark);
    }

    // And it must actually strip, or the exemption it exists to grant is a no-op. This direction is
    // the safe one — a no-op stripper turns the assertion above RED rather than green — so it is
    // checked as "something went", not as a quantity that moves whenever anybody writes a comment.
    // Deliberately NOT an absolute floor: a number decays as the file shrinks, a fact does not.
    expect(stripped.length, "the stripper removed nothing at all").toBeLessThan(component.length);
  });

  it("keeps the INTERNAL name, so this file is about user-facing names and not a rename sweep", () => {
    // The COMPONENT keeps its name. Nobody meets it, and renaming it would move every import for
    // no reader's benefit. The page no longer names it because the page no longer renders it —
    // `LiveTracker` is now unreachable by routing, and deleting it is governed by
    // docs/agents/dead-code-deletion.md, which this merge deliberately does not run.
    expect(component).toContain("LiveTracker");
  });
});
