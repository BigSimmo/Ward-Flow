import { render, screen, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { communityNameCollisions } from "@/components/ward-management/community/community-vocabulary";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";

/**
 * 🔴 **THE OWNER RULED ON 2026-09-05 THAT A TEAM PAGE MUST SAY ITS NAME IS SPELLED MORE THAN ONE WAY
 * IN THE SOURCE DOCUMENT — AND THAT THE SPELLINGS MUST NOT BE MERGED.** The refusal is the
 * load-bearing half: normalising them means the software deciding `Midalnd` means `Midland` and
 * silently moving a patient from one team's list to another's on a guess.
 *
 * ⚠️ **THIS GUARDS THE CLAIM, NOT THE SENTENCE.** Pinning the wording would make an honest rewrite
 * go red, and this project has already been caught twice by both mirrors of that mistake — a guard
 * three rephrasings restored to green, and a guard that forbade improving a sentence. So nothing
 * below matches prose. What is asserted is the property the ruling actually states:
 *
 * > **The warning is on a team's page exactly when that team's name has a near-duplicate in the
 * > source list, and it names every one of that team's siblings.**
 *
 * 🔴 **AND HERE IS WHAT THIS FILE CANNOT SEE, WHICH NOTHING IN IT SAYS UNTIL NOW.**
 *
 * The assertions below are a BICONDITIONAL between what `communityNameCollisions()` returns and
 * what the page renders. **Both sides come from the same function.** So it proves the page agrees
 * with the predicate, and proves nothing whatever about whether the predicate is RIGHT — change the
 * predicate and both sides move together.
 *
 * Measured, 2026-09-05, at Ward Verifier's suggestion and by Ward Builder One:
 *
 *   truncate `communityNameCollisions` to ONE family    caught — but only by the anti-vacuity
 *                                                        FLOOR, not by any biconditional assertion
 *   truncate it to FIVE families, clearing the floor     🔴 SURVIVED. Five real families dropped,
 *                                                        `Midland`/`Midalnd` among them, all green
 *   reword an unrelated sentence on the same screen      survived, correctly — this file is not
 *                                                        red at everything, which is the control
 *
 * **So a wrong predicate is invisible here, and a grossly empty one is caught by a floor rather
 * than by anything that understands the claim.** That limitation is argued in
 * `community-vocabulary.ts` beside the whitespace fix — *"changing the predicate moves both
 * sides"* — **but it was documented in the wrong file, and that is the more dangerous half: a
 * reader of THIS file sees a thorough-looking biconditional with no statement of its own limits,
 * and reasonably concludes the near-duplicate rule is covered.**
 *
 * ⚠️ **WHAT ACTUALLY COVERS THE PREDICATE, and neither of them is here:**
 *   `tests/ward-community-vocabulary.test.ts` — a HAND-RECORDED baseline of the expected families,
 *     which is a second source the predicate cannot vouch for. This is why its add/add conflict at
 *     the 2026-09-05 fold mattered so much: two files with the same four test titles and different
 *     recorded families, and taking the wrong one would have silently dropped `Wheat Belt`.
 *   Ward Builder Three's INDEPENDENT implementation of the same rule for the community gateway.
 *
 * **Both of those found a real bug on 2026-09-05. This biconditional found neither** — not the
 * whitespace defect splitting `Wheat Belt` from `Wheatbelt HS`, nor the word-order defect
 * splitting one Armadale service across two families. **Do not delete this file; it catches a page
 * that stops honouring the rule. Do not believe it covers the rule itself.**
 *
 * ⚠️ **AND THE RULE THAT ACTUALLY WORKS, because "derive it one layer down" is NOT enough and we
 * proved that the expensive way.** The repaired version of this guard derived its expectation from
 * `communityNameCollisions()` while the page used `nearDuplicateSpellingsOf()` — one layer apart,
 * which felt independent. **Truncating the SHARED layer beneath both to five families still
 * SURVIVED**, dropping five real families with everything green. Two derivations that are one step
 * apart still stand on the same thing, so they still move together.
 *
 *   **Rebuild the expectation from the FIXTURE, sharing no function in the chain.**
 *   **And to test whether you have: break the DEEPEST SHARED THING, not the function under test.**
 *
 * Breaking the function under test proves only that the test is wired up. Breaking the deepest
 * shared dependency is the mutation that tells you whether the two sides are genuinely independent
 * — and it is the one nobody runs, because by then the guard looks thorough.
 *
 * Recorded here by Ward Lead on 2026-09-05 from Ward Builder One's measurement and Ward Builder
 * Two's generalisation, because it existed only in chat and would have died with those sessions.
 * Ward Builder Two notes its own `ward-ed-legal-clock` guard happens to have the right shape —
 * **but only because `isCommunityFormed` is module-private and the lazy route was closed to it.**
 * Luck rather than judgement, which is exactly why the rule is worth stating.
 *
 * ⚠️ **IT IS A BICONDITIONAL BECAUSE THE OTHER DIRECTION IS THE ONE NOBODY WOULD NOTICE.** A warning
 * shown on a page with no duplicate is not a harmless extra: it tells a reader that the list in
 * front of them is split when it is not, which is a false statement about a clinical list, and it
 * is exactly what a well-meaning simplification to "show it everywhere" produces. Ward Builder
 * Three specified this direction before the sentence was written.
 *
 * ⚠️ **THE POPULATION IS FLOORED, NOT THE FINDINGS.** Every team page is walked, and both classes
 * must be non-empty — a run where nothing has a near-duplicate, or where everything does, proves
 * nothing and says so rather than passing.
 */

/**
 * 🔴 **THE EXPECTED SIBLINGS, DERIVED WITHOUT TOUCHING THE FUNCTION THE PAGE USES — AND A MUTATION
 * PROVED THIS IS NOT PEDANTRY.** A first version of this file read the screen's own
 * `nearDuplicateSpellingsOf` on both sides: once for what the page should say, once through the page
 * itself. Truncating that function to its first result — a team naming one of its two other
 * spellings, and looking complete — **left every assertion here green**, because the expectation
 * moved with the defect. The two operands were the same value, so they could not disagree.
 *
 * The expectation is therefore rebuilt from `communityNameCollisions()`, one layer below the
 * function under test. The same truncation now goes red naming the teams.
 */
function siblingsOf(teamName: string): readonly string[] {
  const family = communityNameCollisions().find((collision) =>
    collision.names.some((entry) => entry.name === teamName),
  );
  if (family === undefined) return [];
  return family.names.map((entry) => entry.name).filter((name) => name !== teamName);
}

afterEach(() => {
  cleanup();
});

function renderTeam(teamId: string) {
  return render(
    <WardFlowProvider>
      <CommunityScreen teamId={teamId} />
    </WardFlowProvider>,
  );
}

/**
 * 🔴 **A CONSTANT CEILING OVER A GROWING POPULATION DECIDES ITS VERDICT BY MACHINE LOAD.**
 *
 * The sweeps below render EVERY community team page, one at a time, in jsdom. Vitest's default
 * per-test ceiling is a flat 30 s. The page list is not flat — it is derived from the source
 * document and grows whenever a team is added. So the cost side grows and the limit side does not,
 * and the gap closes silently until a run on a busy machine lands on the wrong side of it.
 *
 * **Measured, not assumed.** Ward Builder Three recorded this file at **33.5 s against the 30 s
 * ceiling on 2026-09-07** and wrote the diagnosis that matters: *"not randomly flaky — it runs
 * close enough to the limit that machine load decides the verdict."* Re-measured 2026-09-10 with
 * only these two files running: **both timed out**, so the margin Three measured is gone.
 *
 * ⚠️ **"Flaky under load" was the wrong description and it hid the repair for three days.** A flake
 * is re-run until green. This is not that: it is red for as long as it stays this slow, and four
 * sessions reported the mutation harness as *broken* on the strength of the same 30 s timeout.
 *
 * **So the budget is derived from the population rather than raised to a new constant** — which
 * would simply reset the same trap one team further out.
 *
 * ⚠️ **The per-page figure below is the second one I wrote, and the first was wrong in a way worth
 * naming.** I divided a TIMED-OUT duration (34 s — the run that never finished) by a page count I
 * had from a different reading (43, when the list actually holds 64) and got "~0.8–0.9 s per page".
 * Neither half was measured from the same thing. A timed-out duration is not how long the work
 * takes; it is how long we waited before giving up. **The real figures, from the passing runs:**
 *
 *     64 team pages
 *     ratified-alias sweep     27.4 s   ≈ 0.43 s per page
 *     near-duplicate sweep     24.5 s   ≈ 0.38 s per page
 *
 * At 3 s per page the budget is 192 s — roughly **7× headroom**, not the 3.5× the wrong arithmetic
 * claimed.
 *
 * **What this deliberately no longer does:** it no longer polices per-page performance. A ceiling
 * this generous catches a runaway, not a slow drift. The per-page figure above is recorded so the
 * drift is still legible to whoever reads a slow run — the alternative was a limit that fails on
 * correct work, which is how a guard gets switched off rather than obeyed.
 */
const SWEEP_BUDGET_MS = COMMUNITY_TEAM_PAGES.length * 3_000;

describe("the near-duplicate warning appears exactly where it is true", () => {
  /**
   * ⚠️ **THE FLOOR FIRST.** Everything below compares two things derived from the same list. If that
   * list were empty, or held no collisions at all, every assertion would pass over nothing.
   */
  it("has a list of team pages, and real collisions inside it", () => {
    expect(COMMUNITY_TEAM_PAGES.length, "there are no community team pages to walk").toBeGreaterThan(40);
    const families = communityNameCollisions();
    expect(
      families.length,
      "no near-duplicate families were derived, so the warning can never be true",
    ).toBeGreaterThan(3);
    const withDuplicates = COMMUNITY_TEAM_PAGES.filter((team) => siblingsOf(team.name).length > 0);
    const without = COMMUNITY_TEAM_PAGES.filter((team) => siblingsOf(team.name).length === 0);
    expect(
      withDuplicates.length,
      "no team page has a near-duplicate, so one side of the biconditional is empty",
    ).toBeGreaterThan(3);
    expect(
      without.length,
      "every team page has a near-duplicate, so the other side of the biconditional is empty",
    ).toBeGreaterThan(10);
  });

  /**
   * 🔴 **THE SENTENCE SAYS "THOSE ARE SEPARATE PAGES HERE", AND THAT IS A CHECKABLE CLAIM ABOUT THE
   * ROUTES, NOT A TURN OF PHRASE.** A sibling spelling that had no page would make the warning point
   * a reader at somewhere that does not exist.
   */
  it("every near-duplicate spelling has a page of its own", () => {
    const pageNames = new Set(COMMUNITY_TEAM_PAGES.map((team) => team.name));
    const orphans = communityNameCollisions()
      .flatMap((family) => family.names.map((entry) => entry.name))
      .filter((name) => !pageNames.has(name));
    expect(
      orphans,
      "a spelling the warning names as a separate page has no page, so the sentence sends a reader nowhere",
    ).toEqual([]);
  });

  /**
   * 🔴 **THE BICONDITIONAL, over every page, in one pass.** Both directions are collected rather than
   * asserted one at a time, so a failure names every page that disagrees instead of the first.
   */
  it(
    "carries the warning on exactly the pages whose name has a near-duplicate",
    () => {
      const missing: string[] = [];
      const spurious: string[] = [];
      let walked = 0;

      for (const team of COMMUNITY_TEAM_PAGES) {
        renderTeam(team.id);
        walked += 1;
        const shown = screen.queryByTestId("ward-community-near-duplicate-warning") !== null;
        const expected = siblingsOf(team.name).length > 0;
        if (expected && !shown) missing.push(team.name);
        if (!expected && shown) spurious.push(team.name);
        cleanup();
      }

      expect(walked, "the sweep rendered no team pages, so it proves nothing").toBe(COMMUNITY_TEAM_PAGES.length);
      expect(
        missing,
        "these teams ARE spelled more than one way in the source document and their pages say nothing about it, " +
          "so a reader takes the list in front of them for the whole team",
      ).toEqual([]);
      expect(
        spurious,
        "these teams have no near-duplicate and their pages warn of one anyway, which tells a reader a complete " +
          "list is split when it is not",
      ).toEqual([]);
    },
    SWEEP_BUDGET_MS,
  );

  /**
   * ⚠️ **NAMING ONE SIBLING OUT OF THREE IS THE FAILURE THIS CATCHES**, and it is invisible to the
   * test above. Three spellings of the same service exist in this list; a warning that named only
   * the first would read as complete.
   */
  it(
    "names every sibling spelling, not just one of them",
    () => {
      const wrong: string[] = [];
      let checked = 0;

      for (const team of COMMUNITY_TEAM_PAGES) {
        const siblings = siblingsOf(team.name);
        if (siblings.length === 0) continue;
        renderTeam(team.id);
        checked += 1;
        const warning = screen.queryByTestId("ward-community-near-duplicate-warning");
        const text = (warning?.textContent ?? "").replace(/\s+/gu, " ");
        for (const sibling of siblings) {
          if (!text.includes(sibling)) wrong.push(`${team.name} does not name ${sibling}`);
        }
        cleanup();
      }

      expect(checked, "no page with a near-duplicate was reached, so this assertion ran over nothing").toBeGreaterThan(
        3,
      );
      expect(wrong, "a warning names some of a team's other spellings and not all of them").toEqual([]);
    },
    SWEEP_BUDGET_MS,
  );
});
