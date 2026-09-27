import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { panelTitlesInOrder } from "./helpers/ward-panels";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { wardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **THE COMMUNITY SCREEN'S PANEL HEADINGS, IN THE THIRD EDITION'S WORDS.**
 *
 * Task D2. Five panels were renamed to the drawing. **Every string below was COPIED out of
 * `community-team-third-edition.html`, never retyped** — errata §AB-3, because retyping silently
 * converts a curly apostrophe or an HTML entity into a plain character and produces a heading that
 * looks identical and matches nothing. (Checked for this file: the drawing uses a plain U+0027 in
 * "team's" and carries no entities in its `h2`s.)
 *
 * ⚠️ **WHY THIS FILE HAD TO EXIST BEFORE THE RENAME COULD BE TRUSTED.** The rename was made and the
 * three community suites stayed green — 81 passed. **Not one of them pinned a panel heading.** The
 * screen's headings were unpinned, so the rename could have been wrong in any of five places and
 * nothing would have said so. A green that survives the change it should have caught is the whole
 * failure mode this project keeps paying for.
 *
 * ⚠️ **AND AN IMPORT CHECK IS NOT A RENDER CHECK.** `ward-community-team-list-source.test.ts` proves
 * the screen is WIRED to the right team list; it reads import statements. **A screen importing the
 * right list and rendering nothing would pass it.** This file is the other half: it renders the
 * screen and reads what a person would see.
 *
 * 🔴 **THE ORDER IS ASSERTED, NOT JUST THE PRESENCE.** An unordered "all five are somewhere" check
 * passes on a screen whose panels have been shuffled into an order the drawing does not have, and
 * order is what a coordinator reads as priority.
 *
 * ⚠️ **AND `toHaveTextContent` / array equality READ `textContent`, WHICH A `display: none` ELEMENT
 * STILL SUPPLIES.** So every heading is also asserted `toBeVisible` — the matcher that fails for
 * `display: none`, `visibility: hidden` and a zero-size box alike. Neither assertion alone closes
 * the hiding case.
 *
 * 🔴 **WHAT THIS FILE DELIBERATELY DOES NOT ASSERT, so nobody "fixes" it by deleting a panel.**
 * The screen still carries panels the drawing does not draw — *Expected back*, *Left the ward
 * another way*, *Referrals we have made*, *What this page cannot tell you*, *Go to*. Under owner
 * ruling **Q-12 nothing is dropped**: they are folded into a drawn panel or listed for the owner,
 * and the list is decided **once**, at the end of Phase 2, by the owner and not by a lane. So this
 * file pins the five renamed headings and their relative order, and is **silent about the extras by
 * design**. An exact whole-page array match would turn a pending owner decision into a test failure.
 *
 * ⚠️ **POPULATION — what a green here walks.** One screen, one seeded team, one viewport, in jsdom.
 * It says nothing about the other fifteen ward screens, nothing about layout, nothing about what a
 * browser renders, and nothing about text size — `vitest` loads no CSS Modules and cannot evaluate a
 * cascade at all.
 */

/** Copied from `community-team-third-edition.html`, in the drawing's own document order. */
const DRAWN_HEADINGS = [
  "Waiting for the team's answer",
  "Worth attention",
  "In a bed or holding one",
  "Admitted while already with the team",
  "Discharged into the catchment",
  "This team",
] as const;

/**
 * The four drawn panels that share the `<main>` column, in the drawing's order.
 *
 * *Coverage limits*, *This team* and *Go to* are rendered in the page's `<aside>` rail, so their DOM
 * position is not their reading position — see the order test below.
 */
const MAIN_COLUMN_ORDER = [
  "How to reach this team",
  "Waiting for the team's answer",
  "Worth attention",
  "In a bed or holding one",
  "Admitted while already with the team",
  // 🔴 FOUR PANELS THE OLD ALLOW-LIST COULD NOT SEE. See the block below — they are not new, they
  // were invisible.
  "Expected back",
  "Discharged into the catchment",
  "Left the ward another way",
  "Referrals we have made",
] as const;

/**
 * 🔴 **THE ALLOW-LIST WAS HIDING FOUR PANELS, AND SWITCHING TO AN EXCLUSION LIST FOUND THEM IN ONE
 * RUN.** This list held four names and filtered the screen's headings down to them, so *Expected
 * back*, *Left the ward another way*, *Referrals we have made* and *What this page cannot tell you*
 * were **invisible to this test by construction** — it could not have failed on them however they
 * were ordered, and it could not have noticed them being added or removed.
 *
 * ⚠️ **That is exactly why Ward Lead ruled mechanism A over this file's old mechanism: an allow-list
 * cannot see an ADDITION.** The four are recorded in their rendered order rather than rewritten to
 * match anything.
 *
 * 🔴 **WHETHER THIS ORDER MATCHES THE DRAWING IS A SEPARATE, OPEN QUESTION AND IS NOT SETTLED HERE.**
 * The owner has ruled that where a screen and its drawing disagree on panel NAMES, **the screens
 * stand and the drawings are updated** — so this list is the app's real order, deliberately, and
 * not a claim about `community-team-third-edition.html`. **The panel ORDER question is with him
 * separately and unanswered.**
 */

/**
 * 🔴 **AN EXCLUSION LIST, NEVER AN ALLOW-LIST — Ward Lead's ruling, 2026-09-12, and the distinction
 * is the whole reason mechanism A was chosen over the one this file used to use.**
 *
 * **An allow-list cannot see an ADDITION.** A panel added to this screen tomorrow is invisible to a
 * filter that only keeps names already written down — it passes, silently, forever. ⚠️ **An
 * exclusion list inverts that: every new panel fails the test until somebody decides about it**,
 * which is the property an order test exists to have.
 *
 * **Each entry carries its own reason, because a bare name here reads as "this one does not
 * matter".**
 */
const RAIL_PANELS_EXCLUDED: readonly { title: string; why: string }[] = [
  {
    title: "Coverage limits",
    why: "rendered in the page's <aside> rail, so its DOM position is not its reading position — and jsdom has no layout to tell them apart",
  },
  {
    title: "This team",
    why: "rendered in the rail for the same reason",
  },
  {
    title: "Go to",
    why: "rendered in the rail — named as a rail panel by this file's own comment, and missed on the first pass of this conversion",
  },
];

/** The wordings the third edition replaced. Each must be gone from the rendered screen. */
const RETIRED_HEADINGS = [
  "Waiting for your answer",
  "Worth your attention",
  "Ours, in a bed or holding one",
  "Admitted while already with this team",
  "Discharged into the area",
] as const;

function renderTeam(teamId: string) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CommunityScreen teamId={teamId} />
    </WardFlowProvider>,
  );
}

describe("the community team screen's third-edition headings", () => {
  const team = COMMUNITY_TEAM_PAGES[0];

  it("has a team to render, so every assertion below walks something", () => {
    expect(COMMUNITY_TEAM_PAGES.length, "no community team pages — every case below would be vacuous").toBeGreaterThan(
      1,
    );
    expect(team.id, "the first team page has no id to route to").toBeTruthy();
  });

  it("renders every heading the drawing draws, and each is actually visible", () => {
    renderTeam(team.id);

    for (const heading of DRAWN_HEADINGS) {
      const found = screen.getByRole("heading", { name: heading });
      expect(found, `the drawing draws "${heading}" and the screen does not render it`).toBeInTheDocument();
      expect(found, `"${heading}" is in the document but not on the screen`).toBeVisible();
    }
  });

  /**
   * 🔴 **THE MAIN COLUMN ONLY, AND THE REASON IS NOT A CONVENIENCE.**
   *
   * The screen is two columns: a main column and an `<aside className={styles.rail}>`. **Coverage
   * limits, This team and Go to live in the rail.**
   *
   * ⚠️ **jsdom HAS NO LAYOUT, so it cannot tell a panel that reads second on screen from one that
   * is second in the DOM.** In a two-column layout those are different things, and asserting the
   * drawing's flat document order against a railed screen would demand a DOM order that may already
   * be visually correct — a guard reddening on correct work.
   *
   * **So this asserts the order of the panels that share the main column**, where DOM order and
   * reading order cannot come apart.
   */
  it("renders the main-column panels in the drawing's order", () => {
    renderTeam(team.id);

    /*
     * ✅ MECHANISM A — every `[data-ward-primitive="panel"]`, from the ONE shared helper, minus the
     * three rail panels named above WITH their reasons. It used to keep only the headings already on
     * a list, which could never see a panel being added.
     */
    const excluded = new Set(RAIL_PANELS_EXCLUDED.map((panel) => panel.title));
    const all = panelTitlesInOrder();
    expect(
      all.length,
      "the screen rendered no panels at all — an order assertion over an empty list passes against " +
        "a blank page, a crashed render and a correct screen alike",
    ).toBeGreaterThan(0);

    for (const panel of RAIL_PANELS_EXCLUDED) {
      expect(
        all,
        `"${panel.title}" is excluded from this order assertion (${panel.why}) but is no longer on ` +
          "the screen at all — an exclusion for a panel that does not exist hides its disappearance",
      ).toContain(panel.title);
    }

    const rendered = all.filter((title): title is string => title !== null && !excluded.has(title));

    expect(
      rendered,
      "the main column's panels are in a different order from the drawing — order is what a " +
        "coordinator reads as priority. A panel ADDED to this screen also fails here, deliberately: " +
        "it must be decided about rather than silently accepted",
    ).toEqual([...MAIN_COLUMN_ORDER]);
  });

  it("no longer renders any retired wording", () => {
    renderTeam(team.id);

    for (const retired of RETIRED_HEADINGS) {
      expect(
        screen.queryByRole("heading", { name: retired }),
        `"${retired}" is the pre-third-edition wording and is still on the screen`,
      ).toBeNull();
    }
  });
});

/**
 * 🔴 **ITEM 45 — THE SUBTITLE NAMES WHO IS STANDING ON THIS SCREEN.**
 *
 * Owner item 45: the community team screen is labelled as the coordinator's view. Before this task
 * the subtitle read "Referrals and bed-flow status." — a description of the page's contents, but
 * nothing on the screen said WHOSE view this is, even though `wardChromeRole` already resolves
 * `/community/<team>` routes to `"coordinator"` (design standard §14 row 6: "The bed coordinator
 * and triage"). This block pins both halves of that fact together: the exact subtitle wording from
 * the 17 September build plan (§3), and that the route this screen renders on really does resolve
 * to the coordinator chrome role — so the label is not just wording, it agrees with the routing.
 */
describe("the community team screen names its viewer (item 45)", () => {
  const team = COMMUNITY_TEAM_PAGES[0];

  it("gives the exact subtitle naming the bed coordinator's view", () => {
    renderTeam(team.id);

    expect(
      screen.getByText("The bed coordinator's view of this team's referrals and bed flow."),
      "the subtitle no longer names the bed coordinator as the viewer, or its wording drifted from " +
        "the build plan's §3",
    ).toBeVisible();
  });

  it("routes to the community chrome role, so the coordinator task inbox is not exposed", () => {
    expect(
      wardChromeRole(`/mockups/ward-flow/community/${team.id}`),
      "this screen's own route no longer resolves to the community chrome role",
    ).toBe("community");
  });
});

/**
 * 🔴 **THE FIGURE-STRIP TILES, AND THIS BLOCK EXISTS BECAUSE THE ONE ABOVE MISSED THEM.**
 *
 * The panel renames went in and every assertion above passed. **The five tiles above the panels
 * still carried the retired wording**, so the screen read _"Discharged into the catchment"_ as a
 * panel heading and _"Discharged into the area"_ as the tile summarising that very panel — the same
 * fact under two names, one of them retired.
 *
 * ⚠️ **`getByRole("heading")` cannot see a tile**, so the block above was green over a population
 * that excluded the exact elements that were wrong. **It was found by a `grep` run for an unrelated
 * reason, not by the test written to catch it.** That is the population failure this plan keeps
 * naming, committed by its own author inside the task that names it.
 *
 * 🔴 **AND THE TILE LABELS ARE NOT THE PANEL HEADINGS — the drawing uses SHORTER ones deliberately:**
 * _"Waiting for an answer"_ on the tile against _"Waiting for the team's answer"_ on the panel;
 * _"Admitted while with the team"_ against _"Admitted while already with the team"_. **Do not
 * "tidy" these into agreement.** Both sets were copied from `bandTiles()` and the panels in
 * `community-team-third-edition.html` respectively.
 */
const DRAWN_TILES = [
  "Waiting for an answer",
  "Admitted while with the team",
  "In a bed or holding one",
  "Expected back",
  "Discharged into the catchment",
] as const;

/** Tile wordings the third edition replaced. */
const RETIRED_TILES = [
  "Waiting for your answer",
  "Ours, in a bed or holding one",
  "Admitted while already with this team",
  "Discharged into the area",
] as const;

describe("the community team screen's figure-strip tiles", () => {
  const team = COMMUNITY_TEAM_PAGES[0];

  it("renders every tile the drawing's band draws", () => {
    renderTeam(team.id);

    for (const label of DRAWN_TILES) {
      expect(
        screen.getAllByText(label).length,
        `the drawing's band draws the tile "${label}" and the screen does not render it`,
      ).toBeGreaterThan(0);
    }
  });

  it("carries no retired tile wording", () => {
    renderTeam(team.id);

    for (const retired of RETIRED_TILES) {
      expect(
        screen.queryAllByText(retired),
        `"${retired}" is a retired tile label and is still on the screen — the panel it summarises ` +
          "has already been renamed, so the same fact would appear under two names",
      ).toEqual([]);
    }
  });

  /**
   * ⚠️ **A tile the app has and the drawing does not — Q-12, listed rather than dropped.**
   * The app carries a **Longest wait** tile; the drawing folds that figure into the first tile's
   * sub-line (`"longest " + dur(f.longest)`) instead of giving it a tile of its own. **Under Q-12
   * nothing is dropped and the owner decides the list once**, so this pins that it is still present
   * — deleting it would break the ruling exactly as silently keeping it unlisted would.
   */
  it("still carries the Longest wait tile, which is a Q-12 item and not this lane's to drop", () => {
    renderTeam(team.id);

    expect(
      screen.getAllByText("Longest wait").length,
      "the Longest wait tile has been dropped — Q-12 says nothing is dropped without the owner",
    ).toBeGreaterThan(0);
  });
});
