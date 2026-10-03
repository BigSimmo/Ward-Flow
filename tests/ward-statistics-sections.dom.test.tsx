import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { expectSays } from "./helpers/ward-caption";

// Same reason as every sibling dom suite: `ClinicalRail` renders next/link anchors, and jsdom
// cannot provide an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { StatisticsCompareScreen } from "@/components/ward-management/statistics/statistics-compare-screen";
import { StatisticsEdScreen } from "@/components/ward-management/statistics/statistics-ed-screen";
import { StatisticsOverviewScreen } from "@/components/ward-management/statistics/statistics-overview-screen";
import {
  statisticsSectionById,
  STATISTICS_OVERVIEW_HREF,
  STATISTICS_SECTIONS,
  STATISTICS_UNIT_CHOOSER_HREF,
  STATISTICS_UNIT_CHOOSER_ID,
} from "@/components/ward-management/statistics/statistics-sections";
import { edStatisticsHref, wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import { StatisticsWardScreen } from "@/components/ward-management/statistics/statistics-ward-screen";
import { MODEL_CLAIMS } from "@/components/ward-management/statistics/statistics-claims-register";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE FOUR STATISTICS SECTION SCREENS, ON THE SCREEN.
 *
 * ⚠️ **WHAT ONLY A RENDERED PAGE CAN PROVE, and therefore what this file is for.**
 * `tests/ward-statistics-sections.test.ts` already proves the section list is coherent and that the
 * routes it names exist on disk. Four things survive a coherent list and can still make these pages
 * lie, and each has its own test below:
 *
 *   1. **A figure appearing where none was measured.** The whole plan is "skeleton means skeleton":
 *      a nought standing in for an unwritten derivation is indistinguishable, on screen, from a
 *      nought that was measured. Until 2026-09-06 the check here was the strongest form available —
 *      the overview page's entire main region had to contain NO numeral at all. The overview page
 *      LEFT THAT RULE BY BEING BUILT, exactly as the comparisons and ward pages did before it: it
 *      now carries real derived figures, so "no numeral anywhere" is no longer a property it can
 *      have. What replaced it is stronger, in `tests/ward-statistics-overview-parked.dom.test.tsx`:
 *      every figure is recomputed independently from the same state and the same derivations the
 *      screen itself calls, and every figure leaf is checked to be pure digits — no dash, no blank,
 *      standing in for a number nobody measured. Every screen still in this file's scope — currently
 *      only the emergency-department detail page — still has its not-built statement checked here to
 *      contain no numeral.
 *   2. **A sub-page shipped without the disclaimer.** A reader can land on any of these directly,
 *      never having seen the home page say the figures are invented and that nothing enforces the
 *      coordinator framing. Each of the four screens is checked for both.
 *   3. **An id that resolves to nothing rendering as an empty unit.** "This ward has nothing to
 *      show" and "there is no such ward" would render identically as a bare shell, and the first is
 *      a false statement about a real ward. Both detail screens are checked in that state.
 *   4. **A heading typed in rather than read from the section list.** The eyebrow is asserted
 *      against `STATISTICS_SECTIONS`, so a screen that hard-coded its own copy of a section name
 *      would fail the moment the list was edited — which is the entire point of the list existing.
 */

/** Collapses the whitespace JSX introduces at line breaks, so a sentence can be pinned whole. */
function normalise(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function renderInProvider(node: ReactNode) {
  return render(<WardFlowProvider initialNow={NOW_ANCHOR}>{node}</WardFlowProvider>);
}

/** The page's own main region — never the navigation rail, which is chrome shared with every
 *  other Ward Flow screen and is not this page's claim about anything. */
function mainOf(testId: string): HTMLElement {
  return within(screen.getByTestId(testId)).getByRole("main");
}

/**
 * A unit built here rather than found in the fixture. `tests/ward-statistics.test.ts` records why:
 * an assertion that searches a collection for an example passes as soon as ANY example exists,
 * including one a live defect still permits.
 */
function aUnit(overrides: Partial<Unit> = {}): Unit {
  const capacity = { value: 0, source: "ward" as const, confirmedAt: NOW_ANCHOR, staleAfterMinutes: 60 };
  return {
    id: "test-ward",
    siteCode: "RPH",
    name: "Test Ward",
    cohort: "Adult",
    lockedBeds: 0,
    authorised: false,
    beds: 0,
    empty: capacity,
    allocatable: capacity,
    allocatableLocked: 0,
    held: 0,
    blocked: 0,
    sexMix: { Female: 0, Male: 0 },
    speciallingCapacity: 0,
    highAcuityCapacity: 0,
    sexDesignation: "Undesignated",
    forensic: false,
    ...overrides,
  };
}

describe("every statistics section page carries the disclaimer", () => {
  const pages: { name: string; testId: string; node: ReactNode }[] = [
    { name: "overview", testId: "ward-statistics-overview-screen", node: <StatisticsOverviewScreen /> },
    { name: "comparisons", testId: "ward-statistics-compare-screen", node: <StatisticsCompareScreen /> },
    {
      name: "one ward",
      testId: "ward-statistics-ward-screen",
      node: <StatisticsWardScreen unitId={allUnits()[0].id} />,
    },
    {
      name: "one emergency department",
      testId: "ward-statistics-ed-screen",
      node: <StatisticsEdScreen edId={allEmergencyDepartments()[0].id} />,
    },
  ];

  it.each(pages)("$name says the figures are invented and that no role gate exists", ({ testId, node }) => {
    renderInProvider(node);

    const governance = screen.getByTestId("ward-statistics-section-governance");
    expect(governance.textContent).toContain("Synthetic prototype");

    const access = screen.getByTestId("ward-statistics-section-access");

    /*
     * ⚠️ **WHOLE SENTENCES, NOT SUBSTRINGS, AND FIX ROUND 1 IS WHY.** These assertions read
     * `toContain("not real figures")` and `toContain("There is no role check on this route.")`,
     * which pin the alarming half of each sentence and leave the qualifying half unguarded — the
     * half that says WHICH things are invented, and that anyone can reach the page. The fold of
     * these two sentences with `statistics-screen.tsx` landed on 2026-09-01; a fold that dropped a
     * clause would have stayed green under the old assertions, which is precisely the failure the
     * duplication note in the frame warned about. Equality on the normalised text is what makes a
     * softened disclaimer fail.
     *
     * ⚠️ **THE ACCESS CLAUSE READS "and read everything on it" AND THAT IS THE FOLDED WORDING, not
     * a leftover from the home page.** Neither original was true of both kinds of page: the home
     * page said "and read every figure on it", which is vacuous here where there is no figure, and
     * this frame stopped at "can reach this page", which dropped the point of the clause on a page
     * full of figures. `statistics-disclaimers.tsx` carries the reasoning. The identical string is
     * pinned in `tests/ward-statistics.dom.test.tsx`, so a page-specific edit fails on one side and
     * a shared edit fails on both.
     */
    expect(normalise(governance.querySelector("p")?.textContent)).toBe(
      "These are not real figures. Every patient, bed, referral and instant this prototype holds is invented, and " +
        "nothing here has been measured against a real service.",
    );
    expect(normalise(access.textContent)).toBe(
      "This is meant to be the coordinator's view — and nothing in this prototype enforces that. There is no " +
        "role check on this route. Anyone who can reach the Ward Flow mockups can reach this page and read " +
        "everything on it. Treat the coordinator framing as a statement of intent, not as access control.",
    );

    // Both sit inside the page's own main region, so a page that rendered them into the rail — or
    // outside the scroll container — would not satisfy this.
    expect(mainOf(testId).contains(governance)).toBe(true);
    expect(mainOf(testId).contains(access)).toBe(true);
  });

  it.each(pages)("$name offers a way back to the statistics hub", ({ node }) => {
    renderInProvider(node);
    expect(screen.getByTestId("ward-statistics-section-back").getAttribute("href")).toBe(
      "/mockups/ward-flow/statistics",
    );
  });

  /**
   * ⚠️ **THE NO-INVENTED-FIGURES ASSERTION, and it is the reason this suite exists.** Every one of
   * these screens states plainly that its section is unbuilt; the risk is that somebody later adds
   * a nought, a dash or a sample number to the same paragraph to "show the shape". A numeral inside
   * the statement that there is no figure is a contradiction the prose alone cannot prevent.
   */
  // One screen per case. This rendered all four into one document until fix round 1, which put four
  // `id="main-content"` landmarks in one page — a state no route can produce, so the test was
  // asserting against a document unlike anything a reader sees.
  it.each(
    pages
      .map((page, index) => ({
        ...page,
        statementTestId: [
          /*
           * ⚠️ THE OVERVIEW PAGE LEFT THIS LIST BY BEING BUILT ON 2026-09-06, exactly as the
           * comparisons and ward pages did before it. It has no "not built" paragraph any more — it
           * now carries real network-wide figures (admission-stage counts, declines by reason, beds
           * being prepared, refused-and-nothing-pending, and network capacity) plus one clearly
           * labelled demonstration chart. "States the absence without a numeral" is not a property
           * this page can have or should have any more. What replaces it is stronger and lives in
           * `tests/ward-statistics-overview-parked.dom.test.tsx`: every one of those figures is
           * recomputed independently from the same state and the same derivations the screen itself
           * calls, and every figure leaf is checked to be pure digits — no dash, no blank standing in
           * for a number nobody measured — while the one invented series stays confined to the
           * labelled demonstration wrapper. Do not add an overview row back here — add it there.
           */
          null,
          /*
           * ⚠️ THE COMPARISONS PAGE LEFT THIS LIST BY BEING BUILT, exactly as the ward page did, and
           * for it the rule does not merely relocate — it STOPS APPLYING. This page now carries two
           * tables of real figures, so "states the absence without a numeral" is not a property it
           * can have or should have. What replaces it is stronger and lives in
           * `tests/ward-statistics-compare-two-tables.dom.test.tsx`: no empty cell in either table,
           * because a blank in a comparison reads as a measured zero — the same defect this no-numeral
           * rule was guarding against, on a page that now has numerals in it.
           */
          null,
          /*
           * ⚠️ THE WARD PAGE LEFT THIS LIST BY BEING BUILT, NOT BY BEING EXEMPTED, and its rule got
           * STRONGER on the way out. It has no single "not built" paragraph any more, so there is
           * nothing here to point at. The same requirement — no numeral inside a statement that
           * there is no figure — is now enforced over all THREE of its nullable measures by
           * `tests/ward-statistics-ward-nulls.dom.test.tsx`, which additionally forbids a trailing
           * dash and forbids an unmeasurable average rendering the same words as a true nought.
           * Removing the row without that file existing would be an exemption; with it, it is a
           * handover. Do not add a ward row back here — add it there.
           */
          null,
          "ward-statistics-ed-not-built-body",
        ][index],
      }))
      .filter((page): page is typeof page & { statementTestId: string } => page.statementTestId !== null),
  )("$name states the absence without a numeral in it", ({ node, statementTestId }) => {
    renderInProvider(node);

    const statement = screen.getByTestId(statementTestId);
    // Not vacuous: the paragraph has to be a real statement, not an empty element that trivially
    // contains no digit.
    expect(statement.textContent?.length ?? 0).toBeGreaterThan(120);
    expect(statement.textContent).not.toMatch(/[0-9]/);
  });
});

describe("across all services — the overview section", () => {
  /*
   * 🔴 **THIS TEST LEFT THE FILE BY THE PAGE BEING BUILT, ON 2026-09-06.** It asserted the strongest
   * possible form of "skeleton means skeleton" — that the overview page's entire main region carried
   * no numeral at all, plus the unbuilt-section notice that said so in words. Both are now false of
   * this page on purpose: it carries real network-wide figures (admission-stage counts, declines by
   * reason, beds being prepared, refused-and-nothing-pending, network capacity) and no longer says
   * "not built" anywhere.
   *
   * What replaces it is stronger, in `tests/ward-statistics-overview-parked.dom.test.tsx`: every one
   * of those figures is recomputed independently from the same state and the same derivations the
   * screen itself calls (so no invented number can substitute for a real one), every figure leaf is
   * checked to be pure digits — no dash, no blank standing in for a number nobody measured — and the
   * one deliberately invented series is checked to stay confined to the labelled demonstration
   * wrapper that admits it is not real. Do not restore a no-numeral test here — extend the parked
   * file instead.
   */

  it("takes its section name from the shared list and states its current scope", () => {
    renderInProvider(<StatisticsOverviewScreen />);

    const section = statisticsSectionById("overview");
    expect(section).toBeDefined();
    expect(screen.getByTestId("ward-statistics-section-eyebrow").textContent).toBe(section?.label);
    expect(mainOf("ward-statistics-overview-screen").textContent).toContain("Network-wide current state");
  });

  /*
   * 🔴 **THIS TEST'S TARGET PARAGRAPH IS GONE ENTIRELY, AND WITH IT BOTH SENTENCES IT CHECKED.** It
   * used to read the `ward-statistics-overview-not-built-body` paragraph and check two things: that
   * an already-deleted 2026-09-01 sentence ("There is no way in from the statistics home page yet —
   * the index that will link here is separate work") had not come back, and that the surviving
   * refusal sentence — "No whole-of-prototype figure has been derived" — was still there. The page
   * rebuild of 2026-09-06 removed that whole paragraph, refusal included, and replaced it with real
   * figures, so there is no longer any element for `screen.getByTestId` to find here.
   *
   * Both halves are still guarded, just not by this test:
   *   - The retired 2026-09-01 sentence describes a reachability gap that has been closed twice over
   *     now — once when the hub index landed, and again when this page stopped having any "not
   *     built" prose at all for the sentence to hide inside. The companion test below still proves
   *     the hub really does link this page, which is the only observable half of that old claim.
   *   - The surviving refusal sentence ("No whole-of-prototype figure has been derived") is now
   *     itself the retired one — `tests/ward-statistics-overview-parked.dom.test.tsx` forbids it by
   *     name ("never claims no whole-of-prototype figure has been derived"), because a page that
   *     renders real figures and still says none has been derived would be contradicting itself.
   */

  it("is linked from the hub index, which is what made that sentence false", () => {
    renderInProvider(<StatisticsScreen />);

    const index = screen.getByTestId("ward-statistics-index");
    const hrefs = Array.from(index.querySelectorAll("a")).map((anchor) => anchor.getAttribute("href"));

    // Rendered, not read off the constant the screen also reads: the assertion is that a reader on
    // the hub can click through to this page, and only an anchor in the document establishes that.
    expect(hrefs).toContain(STATISTICS_OVERVIEW_HREF);
    expect(STATISTICS_SECTIONS[0]?.href).toBe(STATISTICS_OVERVIEW_HREF);
  });
});

/**
 * ⚠️ **THE CLAIMS THESE PAGES MAKE ABOUT THE DATA MODEL, PINNED — because this is the failure this
 * screen keeps producing.** Three times in one day a passage here has stated a correct conclusion
 * from a wrong reason, with every test green: a page cannot be checked by a reader, so a confident
 * sentence about the model carries the authority of the model itself.
 *
 * The clause `ReferralAddressing` "carries no unit at all" rendered on three pages until
 * 2026-09-01 and was false — `acceptedUnitId` is on that record (`ward-model.ts`, read directly).
 * The conclusion it supported was right, which is exactly why nothing caught it. These assertions
 * pin the corrected shape: the false clause must not come back, and the field that makes the
 * asymmetry true must be named where the asymmetry is claimed.
 */
describe("what the pages say about the model is true of the model", () => {
  const claims: { name: string; node: ReactNode; testId: string }[] = [
    {
      name: "the comparisons page's declines example",
      node: <StatisticsCompareScreen />,
      testId: "ward-statistics-compare-declines-example",
    },
    {
      name: "the overview page's precedent note",
      node: <StatisticsOverviewScreen />,
      testId: "ward-statistics-overview-precedent",
    },
    {
      // The home screen belongs to Task 2 and is imported read-only. This guard is deliberately
      // narrow — a negative on one retracted clause plus the field that replaced it — so a
      // legitimate Task 2 edit to that page cannot trip it, while a return of the false sentence
      // fails here rather than nowhere.
      name: "the statistics home page's withheld-declines passage",
      node: <StatisticsScreen />,
      testId: "ward-statistics-declines-withheld",
    },
  ];

  it.each(claims)("$name never says the record carries no unit", ({ node, testId }) => {
    renderInProvider(node);
    const text = normalise(screen.getByTestId(testId).textContent);

    expect(text.length).toBeGreaterThan(120);
    expect(text).not.toMatch(/carries no unit/i);
    expect(text).not.toMatch(/no unit at all/i);
  });

  /*
   * 🔴 THIS ASSERTED `toContain("acceptedUnitId")` UNTIL 2026-09-06, AND THE OWNER RULED THE FIELD
   * NAMES OFF THE PROTOTYPE — "don't publish on the prototype". So the identifier is gone from all
   * three pages, and this guard had to move with it or be deleted.
   *
   * ⚠️ **IT WAS PINNING THE RENDERING AS A PROXY FOR THE CLAIM**, which is the standing policy's own
   * named failure: *guard the claim and the clinical property, never the rendering.* The claim was
   * never "the string `acceptedUnitId` appears" — it is **the asymmetry**: that record CAN name a
   * ward, the place it does so is filled in only on acceptance, and therefore an acceptance is
   * attributable and a decline is not. That is what these three pages must keep saying, in whatever
   * words, and it is what is asserted now.
   *
   * ⚠️ **AND THE IDENTIFIER STAYS CHECKABLE, WHICH IS THE OTHER HALF OF THE OWNER'S RULING.** Two
   * things hold it: `statistics-claims-register.ts` pins `acceptedUnitId` as EVIDENCE in
   * `ward-model.ts` with a falsifier, so the claim still goes red if the model changes; and each
   * screen's source carries the identifier in a comment, asserted below, so the pointer a developer
   * needs cannot be deleted quietly along with the rendered one.
   */
  it.each(claims)("$name still states the asymmetry, in whatever words", ({ node, testId }) => {
    renderInProvider(node);
    const claim = screen.getByTestId(testId);
    const scope = claim.closest("article") ?? claim.closest('[data-ward-primitive="panel"]') ?? claim;
    const text = normalise(scope.textContent);

    // The mechanism: the ward-naming place exists and is written only on acceptance.
    expect(text, "the page no longer says the ward is named only when a ward accepts").toMatch(
      /only when (?:that |a )?ward accepts/i,
    );
    // Half one: an acceptance CAN be attributed to a named ward.
    expect(text, "the page no longer says an acceptance names a ward").toMatch(
      /acceptance (?:is attributable to|names) a(?: named)? ward|names? (?:its |a )?ward only when (?:that |a )?ward accepts/i,
    );
    // Half two: a decline CANNOT. A page that kept the premise and dropped this would pass the
    // negative above and say nothing useful — the failure the original guard was written against.
    expect(text, "the page no longer says a decline cannot name a ward").toMatch(
      /decline (?:is not|cannot|and a decline)|declines? do not name a ward|names? (?:its |a )?ward only when (?:that |a )?ward accepts/i,
    );
  });

  it.each(claims)(
    "$name keeps the identifier in its registered evidence, so the claim stays checkable",
    ({ testId }) => {
      /*
       * The owner's ruling was that the field names must not be PUBLISHED, not that they must be
       * lost. This is the half that makes "keep the explanations checkable" a tested property rather
       * than a promise: the screen that makes the claim must still name the field somewhere a
       * developer reads.
       */
      const claimIdByTestId: Record<string, string> = {
        "ward-statistics-compare-declines-example": "statistics-compare-screen/declines/addressing-has-one-unit-field",
        "ward-statistics-overview-precedent": "statistics-overview-screen/precedent/addressing-has-one-unit-field",
        "ward-statistics-declines-withheld": "statistics-screen/declines/addressing-has-one-unit-field",
      };
      const claimId = claimIdByTestId[testId];
      expect(claimId, `no registered claim recorded for ${testId}`).toBeDefined();
      const registered = MODEL_CLAIMS.find((claim) => claim.id === claimId);
      expect(registered, `${claimId} is no longer in the active claims register`).toBeDefined();
      expect(registered?.claim, `${claimId} no longer names acceptedUnitId`).toContain("acceptedUnitId");
      expect(registered?.evidence, `${claimId} has no source evidence`).toBeTruthy();
      expect(registered?.falsifiedBy, `${claimId} has no falsifier`).toBeTruthy();
    },
  );
});

describe("ward and ED comparisons — the chooser", () => {
  it("links to every ward and every emergency department in the network", () => {
    renderInProvider(<StatisticsCompareScreen />);

    // Compared as whole lists rather than one membership check per unit: an equality on the full
    // sequence fails on a ward that is missing, a ward that appears twice, and a link pointing at
    // the wrong unit, where a per-unit `toContain` would pass through the first two.
    const wardList = screen.getByTestId("ward-statistics-compare-ward-list");
    const wardHrefs = Array.from(wardList.querySelectorAll("a")).map((link) => link.getAttribute("href"));
    expect(wardHrefs).toEqual(allUnits().map((unit) => wardStatisticsHref(unit.id)));
    for (const unit of allUnits()) {
      expect(wardList.textContent).toContain(unit.name);
    }

    const edList = screen.getByTestId("ward-statistics-compare-ed-list");
    const edHrefs = Array.from(edList.querySelectorAll("a")).map((link) => link.getAttribute("href"));
    expect(edHrefs).toEqual(allEmergencyDepartments().map((department) => edStatisticsHref(department.id)));
    for (const department of allEmergencyDepartments()) {
      expect(edList.textContent).toContain(department.name);
    }
  });

  /**
   * Finding 7. `Movement.referredUnitIds` is a LIST — one referral can be live at several wards at
   * once — so a per-ward "referrals received" column sums to more than the number of referrals that
   * exist. This is a second failure mode beside the declines one and it fails differently: the
   * declines column silently narrows its population, this one silently inflates it, and the
   * inflation reconciles to nothing and gets blamed on the arithmetic. Both are named on the page
   * because both decide whether a column may be built at all.
   */
  it("names the two ways a per-ward column goes wrong, and the rule that catches both", () => {
    renderInProvider(<StatisticsCompareScreen />);

    const rule = normalise(screen.getByTestId("ward-statistics-compare-attributability-rule").textContent);
    expect(rule).toContain("required unit id");
    // Was `toContain("Admission")` until 2026-09-06, when the owner ruled the field names off the
    // prototype. The claim is that ADMISSIONS attribute cleanly BECAUSE the ward is always present —
    // the record and the guarantee, which is what the rule turns on. The identifier was the proxy.
    expect(rule, "the rule no longer names admissions as the record that attributes cleanly").toMatch(/admission/i);
    expect(rule, "the rule no longer says the ward is always present on that record").toMatch(
      /always (has one|carries|present)|with no exceptions/i,
    );

    const doubleCount = normalise(screen.getByTestId("ward-statistics-compare-double-count-example").textContent);
    // Was `toContain("Movement.referredUnitIds")` until 2026-09-06. The claim is that the referred
    // wards are a LIST rather than one ward, which is what makes the column double-count — asserted
    // directly below, where it was previously carried by the identifier plus a phrase.
    expect(doubleCount, "the page no longer says the referred wards are a list rather than one").toMatch(
      /as a LIST, not a single ward|list, not a single id/i,
    );
    expect(doubleCount).toMatch(/sum to more than/);
  });

  it("carries the anchor the per-unit section links to, and denies that the list is an ordering", () => {
    renderInProvider(<StatisticsCompareScreen />);

    const perUnit = STATISTICS_SECTIONS.find((section) => section.id === "units");
    expect(perUnit?.href).toContain(`#${STATISTICS_UNIT_CHOOSER_ID}`);
    expect(document.getElementById(STATISTICS_UNIT_CHOOSER_ID)).not.toBeNull();

    expect(screen.getByTestId("ward-statistics-compare-order-note").textContent).toContain("carries no meaning");
  });

  /**
   * The conservative failure `ward-index.tsx` holds to, checked here because this chooser is the
   * ONLY link to a ward's statistics page: a unit silently dropped from it is unreachable AND
   * unreported, which is strictly worse than a ward whose hospital cannot be named.
   */
  it("still lists a ward whose site code resolves to nothing, and says so", () => {
    renderInProvider(
      <StatisticsCompareScreen
        units={[aUnit({ id: "unplaceable-ward", name: "Unplaceable Ward", siteCode: "NO-SUCH-SITE" })]}
        emergencyDepartments={[]}
      />,
    );

    const link = screen.getByRole("link", { name: /Unplaceable Ward/ });
    expect(link.getAttribute("href")).toBe(wardStatisticsHref("unplaceable-ward"));
    expectSays(link.textContent, "the unknown-site notice", ["no site", "matches no site"]);
  });

  it("says so rather than rendering an empty list when there is nothing to choose", () => {
    renderInProvider(<StatisticsCompareScreen units={[]} emergencyDepartments={[]} />);

    expect(screen.getByTestId("ward-statistics-compare-no-wards").textContent).toContain("No ward is recorded");
    expect(screen.getByTestId("ward-statistics-compare-no-eds").textContent).toContain(
      "No emergency department is recorded",
    );
    expect(screen.queryByTestId("ward-statistics-compare-ward-list")).toBeNull();
    // Polish items 13 and 14 (Josh approved, 26 Sept 2026): the two chart cards say so too, rather
    // than an empty card under a heading.
    expect(screen.getByTestId("ward-statistics-compare-ward-chart-empty").textContent).toBe(
      "No ward is recorded in this prototype, so there is nothing to chart.",
    );
    expect(screen.getByTestId("ward-statistics-compare-ed-chart-empty").textContent).toBe(
      "No emergency department is recorded in this prototype, so there is nothing to chart.",
    );
  });
});

/**
 * ⚠️ **THE FRAGMENT, ON EVERY LINK THAT CLAIMS TO OFFER THE CHOOSER.** Fix round 1: all four
 * in-page links back to the chooser used the bare comparisons href, so a reader who clicked
 * "choose a ward" landed at the top of a page opening with two sections about why no comparison
 * exists and had to scroll to find the list — and the assertion in this file pinned the bare href
 * as intended behaviour, which is worse than the miss. Asserted on every link, in both states of
 * both detail screens, because a fix applied to three of the four would look identical in review.
 */
describe("every link that offers the chooser lands on the chooser", () => {
  const links: { name: string; node: ReactNode; testId: string }[] = [
    {
      name: "the ward page for a ward that exists",
      node: <StatisticsWardScreen unitId={allUnits()[0].id} />,
      testId: "ward-statistics-ward-chooser-link",
    },
    {
      name: "the ward page for an id that resolves to nothing",
      node: <StatisticsWardScreen unitId="no-such-ward" />,
      testId: "ward-statistics-ward-chooser-link",
    },
    {
      name: "the department page for a department that exists",
      node: <StatisticsEdScreen edId={allEmergencyDepartments()[0].id} />,
      testId: "ward-statistics-ed-chooser-link",
    },
    {
      name: "the department page for an id that resolves to nothing",
      node: <StatisticsEdScreen edId="no-such-ed" />,
      testId: "ward-statistics-ed-chooser-link",
    },
  ];

  it.each(links)("$name links to the anchor, not the top of the comparisons page", ({ node, testId }) => {
    renderInProvider(node);

    const href = screen.getByTestId(testId).getAttribute("href");
    expect(href).toBe(STATISTICS_UNIT_CHOOSER_HREF);
    // Spelled out as well as compared to the constant: a constant that lost its fragment would
    // satisfy the equality above on both sides and change nothing that fails.
    expect(href).toBe(`/mockups/ward-flow/statistics/compare#${STATISTICS_UNIT_CHOOSER_ID}`);
  });

  it("puts the anchor those links point at on the comparisons page with reachable unit links", () => {
    renderInProvider(<StatisticsCompareScreen />);

    expect(document.getElementById(STATISTICS_UNIT_CHOOSER_ID)).not.toBeNull();
    const chooser = document.getElementById(STATISTICS_UNIT_CHOOSER_ID)!;
    expect(within(chooser).getAllByRole("link").length).toBeGreaterThan(0);
  });
});

describe("one ward in detail", () => {
  it("names the ward and its hospital, and measures nothing about it", () => {
    renderInProvider(
      <StatisticsWardScreen
        unitId="test-ward"
        units={[aUnit({ id: "test-ward", name: "Test Ward", siteCode: "RPH" })]}
      />,
    );

    expect(screen.getByTestId("ward-statistics-ward-site").textContent).toBe(
      "Test Ward is recorded at Royal Perth Hospital.",
    );
    expect(screen.getByTestId("ward-statistics-ward-measures")).toBeTruthy();
    expect(screen.queryByTestId("ward-statistics-ward-unresolved")).toBeNull();
  });

  /**
   * ⚠️ **THIS TEST'S NAME USED TO CLAIM MORE THAN ITS BODY COULD PROVE.** It was titled "resolves
   * the ward from live provider state, not from a fixture handed in", but `seeded` and the
   * provider's own units both come from `allUnits()` and nothing here ever dispatched — live
   * state and seed state are identical by construction, so a component that ignored the provider
   * and read `allUnits()` directly would have passed this test too.
   *
   * A real live-vs-seed test needs a way to make the two differ. Checked both routes: no event in
   * `ward-flow-events.ts` ever assigns `Unit.name` or `Unit.siteCode` (grepped the reducer for
   * both — neither appears as an assignment target anywhere), and `scenarioUnits()` in
   * `ward-scenarios.ts` says outright that a scenario switch changes "OPERATIONAL NUMBERS ONLY" —
   * `allocatable`/`speciallingCapacity` — never a unit's name or site. `WardFlowProvider` itself
   * takes only `initialNow`; it has no seed-override prop that could hand the provider a unit list
   * disagreeing with `allUnits()`. This screen renders exactly two things about a resolved unit —
   * its name and its site placement — and neither one is reachable by any dispatchable event. The
   * property the old title claimed is not observable through this component's current props and
   * this reducer's current events, so the name changed rather than staying wrong.
   */
  it("renders the resolved ward's name and site placement, rather than falling into the not-found state", () => {
    const seeded = allUnits()[0];
    renderInProvider(<StatisticsWardScreen unitId={seeded.id} />);

    expect(screen.getByTestId("ward-statistics-ward-site").textContent).toContain(seeded.name);
    expect(screen.queryByTestId("ward-statistics-ward-unresolved")).toBeNull();
  });

  /**
   * ⚠️ The honest not-found state. An empty shell would render as a ward with nothing to show, and
   * a reader would take that as a fact about a real ward.
   */
  it("says no such ward exists, names the id, and never falls back to another ward", () => {
    renderInProvider(<StatisticsWardScreen unitId="no-such-ward" />);

    const unresolved = screen.getByTestId("ward-statistics-ward-unresolved");
    expect(unresolved.textContent).toContain("no-such-ward");
    /*
     * 🔴 **POLARITY-BLIND, AND THIS ONE IS A PATIENT-SAFETY CLAIM. Measured 2026-09-09.**
     * `["falls back", "fall back"]` is the SUBJECT of a refusal, and the sentence carries it in
     * either direction. Rendered *"This page falls back to the nearest other ward, because a page
     * showing the wrong ward under the right heading is better than a page showing nothing"* — the
     * exact inversion of the rule — and **no guard fired at all.**
     *
     * The screen would be promising it never substitutes a ward while announcing that it does. One
     * ward's patients under another ward's heading is the harm this paragraph exists to refuse.
     * Every spelling now carries the negation.
     */
    expectSays(unresolved.textContent, "the no-fallback-ward refusal", [
      "never falls back",
      "does not fall back",
      "will not fall back",
      "never substitutes",
      "never shows a different",
    ]);

    // Not an empty shell, and not a page about some other ward.
    expect(screen.queryByTestId("ward-statistics-ward-identity")).toBeNull();
    // The not-found state must not carry the measures section either — a page about no ward
    // showing measures would be showing them about nothing.
    expect(screen.queryByTestId("ward-statistics-ward-measures")).toBeNull();
    for (const unit of allUnits()) {
      expect(mainOf("ward-statistics-ward-screen").textContent).not.toContain(unit.name);
    }

    // Still a page of this prototype: the disclaimer is on the error state too.
    expect(screen.getByTestId("ward-statistics-section-governance").textContent).toContain("not real figures");
    expect(screen.getByTestId("ward-statistics-ward-chooser-link").getAttribute("href")).toBe(
      STATISTICS_UNIT_CHOOSER_HREF,
    );
  });

  it("says it cannot place a ward whose site code resolves to nothing, rather than guessing one", () => {
    renderInProvider(
      <StatisticsWardScreen
        unitId="unplaceable-ward"
        units={[aUnit({ id: "unplaceable-ward", name: "Unplaceable Ward", siteCode: "NO-SUCH-SITE" })]}
      />,
    );

    expect(screen.getByTestId("ward-statistics-ward-site").textContent).toContain(
      "carries a site code this prototype has no site for",
    );
  });

  /**
   * ⚠️ **THE ENUMERATION THIS PAGE USED TO CARRY, AND WHY IT MAY NOT COME BACK.** The blocked-figure
   * paragraph listed `Admission`'s instants as five — the pull, the arrival, the expected discharge
   * date, when that date was set, and the departure — copied from `ward-statistics.ts`'s own doc
   * comment. The record carries seven, plus a nested `followUp.recordedAt`;
   * `awayAtEmergencyDepartmentSince` and `dischargeConfirmedAt` were missing from both.
   *
   * The conclusion survived — neither omitted instant marks entry to `waitlisted` — which is
   * precisely why nothing caught it. A wrong enumeration reads as the most checkable sentence on
   * the page to a reader who cannot check it. So the page states the property of the whole set and
   * never the list, and this test forbids the list from returning: an enumeration copied out of a
   * file this page cannot edit drifts silently by construction.
   */
  it("states the waitlist gap without enumerating the admission record's instants", () => {
    renderInProvider(
      <StatisticsWardScreen
        unitId="test-ward"
        units={[aUnit({ id: "test-ward", name: "Test Ward", siteCode: "RPH" })]}
      />,
    );

    // Repointed 2026-09-05: this paragraph is now the built `Average wait after being accepted`
    // measure rather than a stub's explanation of one. The rule it carries is unchanged, which is
    // why the assertions below are untouched.
    const blocked = normalise(screen.getByTestId("ward-stat-waitlist-wait").textContent);

    // The conclusion, unchanged and still the point of the paragraph.
    // 🔴 "Admission" REMOVED — the paragraph uses it constitutively, three times, none of them the
    // claim this site guards. Measured 2026-09-09: the refusal "The admission record carries no
    // instant marking the moment a person joined the waiting list" softened to "does not currently
    // show when a person joined" — turning an architectural absence into an ordinary missing value,
    // a materially weaker and different claim — and 39/39 PASSED.
    expectSays(blocked, "the waitlist-timing refusal", ["no instant", "carries no instant", "no timestamp"]);
    expectSays(blocked, "the waitlist-timing refusal", ["deliberately not listed", "not listed"]);

    /*
     * ⚠️ **THE CHARACTERISATION BESIDE IT WAS FALSE UNTIL 2026-09-01, AND IS NOW PINNED BOTH WAYS.**
     * The paragraph said the record's instants were "every one of them about the bed or about the
     * discharge plan". `ward-admissions.ts` says the opposite of one of them, in bold, on the field:
     * `awayAtEmergencyDepartmentSince` "is a fact about the PERSON, which is why it is a field and
     * not a state". That distinction is load-bearing rather than decorative — the bed stays occupied
     * while somebody is away at an emergency department, and every availability figure depends on it
     * — so flattening it is not a rounding error.
     *
     * The replacement states a FLOOR ("at least one"), never a count and never an absolute, so a
     * further person-fact instant arriving cannot falsify it and no enumeration returns.
     */
    expect(blocked).toContain("not all of one kind");
    expectSays(blocked, "the person-versus-bed note", ["about the person", "rather than about the bed"]);
    expect(blocked).not.toContain("every one of them is about the bed");
    expect(blocked).not.toContain("about the bed or about the discharge plan; none is the moment");

    // And the retired list, forbidden by name. Any of these three phrases returning means somebody
    // has re-copied the five-item enumeration.
    expect(blocked).not.toContain("The record keeps the pull, the arrival");
    expect(blocked).not.toContain("when that date was set, and the departure");
    expect(blocked).not.toContain("none of them is that moment");
  });
});

describe("one emergency department in detail", () => {
  it("names the department and its hospital, and measures nothing about it", () => {
    const department = allEmergencyDepartments()[0];
    renderInProvider(<StatisticsEdScreen edId={department.id} />);

    expect(screen.getByTestId("ward-statistics-ed-site").textContent).toContain(department.name);
    expect(screen.getByTestId("ward-statistics-ed-not-built")).toBeTruthy();
    expect(screen.queryByTestId("ward-statistics-ed-unresolved")).toBeNull();
  });

  it("says no such department exists, names the id, and never falls back to another one", () => {
    renderInProvider(<StatisticsEdScreen edId="no-such-ed" />);

    const unresolved = screen.getByTestId("ward-statistics-ed-unresolved");
    expect(unresolved.textContent).toContain("no-such-ed");
    // 🔴 The same polarity defect as the ward refusal above, measured the same way and on the same
    // day: *"This page falls back to a different department, because ... is better than a page
    // showing nothing"* left every guard green. Two screens carried one wording and one defect.
    expectSays(unresolved.textContent, "the no-fallback-department refusal", [
      "never falls back",
      "does not fall back",
      "will not fall back",
      "never substitutes",
      "never shows a different",
    ]);

    expect(screen.queryByTestId("ward-statistics-ed-identity")).toBeNull();
    expect(screen.queryByTestId("ward-statistics-ed-not-built")).toBeNull();
    for (const department of allEmergencyDepartments()) {
      expect(mainOf("ward-statistics-ed-screen").textContent).not.toContain(department.name);
    }

    expect(screen.getByTestId("ward-statistics-section-governance").textContent).toContain("not real figures");
  });

  /**
   * ⚠️ **"THE TWO CLOCKS THE REFERRAL RECORD ALREADY KEEPS" NAMED NEITHER AND COULD DEFEND
   * NEITHER.** `Referral.raisedAt` is required; `triagedAt` is OPTIONAL, so a referral may carry
   * none at all, and nothing in the model orders the two — a triage instant may sit EARLIER than
   * the `raisedAt` beside it, because somebody can be in a department for hours before psychiatry
   * is called. Two instants that can be absent and can run backwards are not a pair a duration may
   * be quietly assumed from.
   *
   * The paragraph's conclusion is unchanged and now stands on the movement side, where
   * `Movement.originEdId` is a required `string`. This test pins both halves: the unnamed claim may
   * not return, and the conclusion must still be attributed to the record that can carry it.
   *
   * ⚠️ **THE FIRST CORRECTION REPLACED AN UNEARNED CLAIM WITH A FIXTURE ONE.** It said "most seeded
   * referrals carry none" and cited the single fixture referral whose triage runs backwards. Both
   * were true on 2026-09-01, both were properties of the SEED rather than of the page, and a seed
   * edit would have falsified them with nothing going red. The last block below is what stops that
   * returning: the paragraph may state what the TYPE establishes and may not state what the data
   * happens to hold, so it carries no quantity at all — and a quantity in prose starts as a
   * numeral or as a word like "most".
   */
  it("names the referral's clocks and their limits rather than asserting an unqualified pair", () => {
    const department = allEmergencyDepartments()[0];
    renderInProvider(<StatisticsEdScreen edId={department.id} />);

    const attributable = normalise(screen.getByTestId("ward-statistics-ed-attributable").textContent);

    /*
     * Was `toContain("raisedAt")` / `toContain("triagedAt")` until 2026-09-06 and the owner ruled the
     * field names off the prototype. The CLAIM is the asymmetry between the referral's two clocks —
     * one always recorded, the other optional — which is what makes an unqualified pair unsafe. That
     * is asserted directly now; the identifiers are pinned as evidence in the claims register.
     */
    expect(attributable, "the page no longer says the raised instant is always there").toMatch(
      /raised is always recorded|raisedAt is always/i,
    );
    expect(attributable, "the page no longer says the triage instant is optional").toMatch(
      /triaged is optional|triagedAt is optional/i,
    );
    expect(attributable).toContain("is optional");
    expectSays(attributable, "the triage-ordering note", ["precede", "before the referral"]);
    // The conclusion, re-attributed to the record that never goes missing.
    expectSays(attributable, "the required-field note", ["required field"]);
    /*
     * 🔴 **POLARITY-BLIND: BOTH SPELLINGS SURVIVE THE NEGATION. Measured 2026-09-09.** *"is not
     * derivable from the movement side, and is shown above anyway"* contains "derivable" AND
     * "movement side", so a page claiming to show a figure it had just said it could not derive
     * passed every guard. A two-spelling list looked like redundancy and was two copies of the
     * same blind spot.
     */
    expectSays(attributable, "the derivability note", [
      "is derivable from the movement side",
      "can be derived from the movement side",
      "comes from the movement side",
    ]);

    // The retired wording, forbidden by name.
    expect(attributable).not.toContain("the two clocks the referral record already keeps");
  });

  it("states the optionality as a property of the type, and counts nothing about the seed", () => {
    const department = allEmergencyDepartments()[0];
    renderInProvider(<StatisticsEdScreen edId={department.id} />);

    const attributable = normalise(screen.getByTestId("ward-statistics-ed-attributable").textContent);

    // Non-vacuity first. Every assertion below is a NOT, and every one of them passes against an
    // empty string — so the paragraph has to be shown to be the paragraph before its absences mean
    // anything.
    expect(
      attributable.length,
      "the attributable paragraph rendered empty — nothing below this line proves anything",
    ).toBeGreaterThan(200);
    expect(attributable, "the paragraph no longer states the model property that replaced the seed claim").toContain(
      "optional, so a referral may carry no triage instant at all",
    );

    // No numeral anywhere in the paragraph. Written as an explicit digit class rather than \d so
    // that no escape sequence is involved: a literal backslash-b pasted into a pattern becomes a
    // backspace byte, matches nothing, and prints as valid — which has already cost this project a
    // day.
    const numeral = attributable.match(/[0123456789]/);
    expect(
      numeral,
      `the paragraph now contains the numeral "${numeral?.[0] ?? ""}" — a figure typed into prose is a claim about ` +
        `the data that nothing can re-check. Render it from live state or leave it out.`,
    ).toBeNull();

    // The words a fixture claim arrives as when it is not a numeral. "most" and "seeded" are the
    // exact words the retired sentence used. Deliberately narrow: "many" is not here, because the
    // paragraph legitimately asks "how many people this department is currently waiting on" — a
    // forbidden word that also occurs innocently teaches the next person to widen the exception
    // rather than fix the sentence.
    for (const quantifier of ["most ", "seeded", "fixture"]) {
      expect(
        attributable.toLowerCase(),
        `the paragraph says "${quantifier.trim()}" — that is a claim about what the seed happens to contain, and it ` +
          `will go false silently the next time the seed is edited.`,
      ).not.toContain(quantifier);
    }
  });
});

describe("StatisticsScreen interactive controls and table sorting accessibility", () => {
  it("renders export button with aria-disabled, describedby and linked hint span", () => {
    renderInProvider(<StatisticsScreen />);
    const exportBtn = screen.getByRole("button", { name: /Export the figures/i });
    expect(exportBtn).toHaveAttribute("aria-disabled", "true");
    expect(exportBtn).toHaveAttribute("aria-describedby", "exportBtnHint");
    const hint = document.getElementById("exportBtnHint");
    expect(hint).toBeInTheDocument();
    expect(hint?.textContent).toContain("Not wired in this prototype");
  });

  it("renders 17 sortable table headers as semantic buttons with aria-sort, and toggles sort direction on click", () => {
    const { container } = renderInProvider(<StatisticsScreen />);

    // Query all th elements with aria-sort
    const sortableThs = container.querySelectorAll("th[aria-sort]");
    expect(sortableThs.length).toBe(17);

    // Each sortable th must contain a <button type="button">
    for (const th of Array.from(sortableThs)) {
      const btn = th.querySelector("button");
      expect(btn).not.toBeNull();
      expect(btn).toHaveAttribute("type", "button");
    }

    // Test sorting on the Hospital column in the Ward table
    const hospTh = container.querySelector("th[aria-sort]:has(button)") as HTMLElement;
    const hospBtn = hospTh.querySelector("button")!;
    const initialSort = hospTh.getAttribute("aria-sort");
    expect(initialSort).toBe("none");

    // Click to sort ascending
    fireEvent.click(hospBtn);
    expect(hospTh.getAttribute("aria-sort")).toBe("ascending");

    // Click to sort descending
    fireEvent.click(hospBtn);
    expect(hospTh.getAttribute("aria-sort")).toBe("descending");
  });
});
