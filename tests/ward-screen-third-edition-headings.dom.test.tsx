import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same jsdom-App-Router workaround as the sibling ward-screen dom suites.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **THE WARD SCREEN NAMES THE SCREEN IN ITS `h1` AND THE WARD IN A PANEL.**
 *
 * Task A1. The drawing's `h1` is the constant **Ward**; the ward's own name is the `h3` of the first
 * panel, **This ward** (`ward-third-edition.html`, `<h2 id="wardH">This ward</h2>` with
 * `<h3 id="wardName">`). The app had it the other way round: the `h1` WAS the ward's name, so every
 * ward rendered a different `h1` and the screen had no stable name anywhere on it.
 *
 * ⚠️ **BOTH HALVES ARE ASSERTED TOGETHER, AND THAT IS NOT BELT-AND-BRACES.** A test that pinned only
 * `h1 === "Ward"` would pass on a screen that had lost the ward's name entirely — **which is the
 * worse of the two defects, because a coordinator cannot tell which ward they are looking at.**
 * Renaming a heading is exactly the change that drops the thing the heading used to carry.
 *
 * 🔴 **THE DOCUMENT TITLE KEEPS THE WARD'S NAME. Only the on-screen `h1` becomes the constant.**
 * A browser tab reading "Ward" for all twenty-three wards is a worse tab than one reading
 * "Ward — FSH Adult Secure", and the two are different surfaces with different jobs. The title is
 * pinned in `tests/ward-screen-third-edition-title.test.ts`, not here — **jsdom renders the
 * component, never the route's metadata**, so this file structurally cannot see it.
 *
 * ⚠️ **POPULATION — what a green here walks.** The `WardScreen` component, over several seeded
 * units, in jsdom, at one viewport. It says **nothing** about the route's metadata, nothing about
 * layout, nothing about what a browser paints, and nothing about text size (`vitest` loads no CSS
 * Modules and cannot evaluate a cascade). The other fifteen ward screens are untouched by it.
 */

/** Copied from `ward-third-edition.html`. ⚠️ This drawing writes `&rsquo;` where the community
 *  drawing writes a plain apostrophe — see the plan's A-prep-1. None of the strings below contains
 *  one, which is why they are safe to compare as plain text. */
const SCREEN_NAME = "Ward";
const FIRST_PANEL = "This ward";

function renderWard(unitId: string) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardScreen unitId={unitId} />
    </WardFlowProvider>,
  );
}

describe("the ward screen's heading contract", () => {
  const units = allUnits();
  /** Several wards, not one — an `h1` hard-coded to one ward's name would pass a single-unit test. */
  const walked = units.slice(0, 4);

  it("has several units to walk, so the assertions below are not vacuous", () => {
    expect(
      units.length,
      "no units in the fixture — every case below would pass having rendered nothing",
    ).toBeGreaterThan(3);
    const distinctNames = new Set(walked.map((unit) => unit.name));
    expect(
      distinctNames.size,
      "the walked units share a name, so a screen hard-coding one ward's name could not be caught",
    ).toBe(walked.length);
  });

  it("names the SCREEN in the h1, identically on every ward", () => {
    for (const unit of walked) {
      renderWard(unit.id);
      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading, `the h1 on ${unit.name} is not the screen's name`).toHaveTextContent(
        new RegExp(`^${SCREEN_NAME}$`, "u"),
      );
      cleanup();
    }
  });

  /**
   * ⚠️ **Queried by ROLE AND ACCESSIBLE NAME, not by a test id.** The panel keeps its existing
   * `ward-unit-card-<id>` test id because `ui-ward-roles.spec.ts` asserts exactly one of those on the
   * route — **adding a second id for this test would have been a new surface invented to satisfy a
   * guard.** Querying the region also asserts the accessible layer, which is the half A-prep-2 says
   * a rename is most likely to leave behind.
   */
  it("still names the WARD, in the This ward panel — the half a lazy rename would drop", () => {
    for (const unit of walked) {
      renderWard(unit.id);
      const panel = screen.getByRole("region", { name: FIRST_PANEL });
      expect(panel, `the This ward panel is missing on ${unit.name}`).toBeVisible();
      expect(panel, `${unit.name}'s own name is no longer anywhere in its This ward panel`).toHaveTextContent(
        unit.name,
      );
      cleanup();
    }
  });

  it("gives the This ward panel the drawing's heading", () => {
    renderWard(walked[0].id);

    const heading = screen.getByRole("heading", { name: FIRST_PANEL });
    expect(heading, `the drawing's first panel is "${FIRST_PANEL}" and the screen does not render it`).toBeVisible();
  });

  /**
   * ⚠️ **A-prep-2: this screen names every panel TWICE** — a section's `aria-label` and its visible
   * heading — **and two pairs already disagree** (`aria-label="Incoming referrals"` against
   * `<h2>Incoming referrals awaiting an answer</h2>`). **The accessible name is what a screen-reader
   * user navigating by region actually hears**, so a rename that moves only the visible heading
   * leaves one panel described two ways to two audiences.
   *
   * 🔴 **This pins the layer, not the wording.** It asserts the ward's name reaches the accessible
   * name of the This ward region — so a future rename cannot satisfy the visible half alone.
   */
  it("the ward's name reaches the ACCESSIBLE name too, not only the visible heading", () => {
    const unit = walked[0];
    renderWard(unit.id);

    const region = screen.getByRole("region", { name: new RegExp(FIRST_PANEL, "u") });
    expect(
      region,
      "the This ward panel has no accessible region name — a screen-reader user navigating by region cannot find it",
    ).toBeInTheDocument();
  });
});

/**
 * 🔴 **TASK A2 — THE PANELS THE DRAWING RENAMES, IN BOTH LAYERS.**
 *
 * Each pair below is `[visible heading, landmark label]`. **They are asserted together because this
 * screen already had two pairs that disagreed** — `aria-label="Incoming referrals"` sat over
 * `<h2>Incoming referrals awaiting an answer</h2>` — and **the label is what a screen-reader user
 * navigating by region actually hears.** A rename that moved only the visible half would leave one
 * panel described two ways to two audiences.
 *
 * ⚠️ **`Today’s return` CARRIES U+2019, NOT A PLAIN APOSTROPHE.** `ward-third-edition.html` writes it
 * as `&rsquo;`; the community drawing writes a plain `'` in its own headings. **Copying from the
 * wrong drawing is the same defect as retyping** — the string below was decoded from this drawing
 * and its codepoint checked, not typed.
 *
 * 🔴 **THE FOURTH PANEL — `Coming in` — WAS HANDED BACK AND THE OWNER HAS SINCE RULED IT IN.**
 * D-20-REVISED. A2 refused the rename because `ward-pull-vocabulary.dom.test.tsx` named that heading
 * and A2 read the guard's property as the wording itself. **It is not:** the property is the "Pull a
 * bed" button and three `not.toMatch(/hold|held/i)` negatives, all of which survive the rename
 * untouched. The heading was incidental to the guard after all.
 *
 * ⚠️ **The rename did NOT come alone, and that is why it took two rulings.** The drawing also
 * replaces the panel's empty state with a sentence naming two states where the app names three. The
 * owner ruled a composition: the drawing's heading, the app's three states, carrying the drawing's
 * *"Absence here means none, not that none was asked for."* **That composed sentence is wording
 * nobody drew** — see `ward-pull-vocabulary.dom.test.tsx` for the reasoning, which lives there
 * because that is the file a future reader will open when they want to change it back.
 */
const RENAMED_PANELS: readonly (readonly [string, string])[] = [
  ["Ward figures, right now", "Ward figures, right now"],
  ["Awaiting your answer", "Awaiting your answer"],
  // D-20-REVISED. Both layers identical on purpose: before the rename the label read "Accepted,
  // pulled or en route" and the heading "Accepted, pulled or en route here" — the same words minus
  // one, the third such pair found on this screen.
  ["Coming in", "Coming in"],
];

/** The wordings A2 replaced. Neither may survive anywhere on the screen, in either layer. */
const RETIRED_PANELS = [
  "Bed capacity",
  "Incoming referrals awaiting an answer",
  "Confirm today's numbers",
  "Accepted, pulled or en route here",
] as const;

describe("the ward screen's third-edition panel names", () => {
  const unit = allUnits()[0];

  it("renders each renamed panel's heading, visibly", () => {
    renderWard(unit.id);

    for (const [heading] of RENAMED_PANELS) {
      const found = screen.getByRole("heading", { name: heading });
      expect(found, `the drawing names this panel "${heading}" and the screen does not`).toBeVisible();
    }
    expect(
      screen.getByRole("heading", { name: "Today’s return" }),
      "the return panel is not the drawing's",
    ).toBeVisible();
  });

  it("gives each renamed panel the matching LANDMARK label, not only the heading", () => {
    renderWard(unit.id);

    for (const [, label] of RENAMED_PANELS) {
      expect(
        screen.getByRole("region", { name: label }),
        `"${label}" is the visible heading but not the landmark label — the two layers disagree`,
      ).toBeInTheDocument();
    }
  });

  it("carries no retired panel wording, in either layer", () => {
    const { container } = renderWard(unit.id);

    for (const retired of RETIRED_PANELS) {
      expect(
        screen.queryByRole("heading", { name: retired }),
        `"${retired}" is pre-third-edition wording and is still a heading`,
      ).toBeNull();
      expect(
        container.querySelector(`[aria-label="${retired}"]`),
        `"${retired}" is gone from the headings but survives as a landmark label`,
      ).toBeNull();
    }
  });
});
