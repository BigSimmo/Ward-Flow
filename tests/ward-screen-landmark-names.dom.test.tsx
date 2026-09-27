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
 * 🔴 **A PANEL'S LANDMARK NAME AND ITS VISIBLE HEADING ARE ONE STRING, NOT TWO THAT MUST AGREE.**
 *
 * Owner ruling D-22. Two panels on this screen carried a hand-written `aria-label` over a heading
 * that interpolated the ward's name — `aria-label="Withdrawn referrals"` above
 * `<h2>Withdrawn from {unit.name}</h2>`, and `aria-label="Overrides recorded against this ward"`
 * above `<h2>Overrides recorded against {unit.name}</h2>`. **A screen-reader user navigating by
 * region heard one name and then read another for the same panel.**
 *
 * ⚠️ **THE RULING DISSOLVED THE QUESTION RATHER THAN ANSWERING IT.** "Generic label or interpolated
 * label" assumes two strings and asks which wording wins. `aria-labelledby` leaves **one** string:
 * the landmark simply IS the heading, whatever the heading later becomes — **including after the
 * structural fold into *The record for today*, which will rewrite both headings and now cannot
 * leave a stale label behind.** A shape that cannot break beats a check that notices it broke.
 *
 * 🔴 **WHY THIS FILE EXISTS AT ALL, AND IT IS THE REASON THE CHANGE WAS NOT MADE SILENTLY.**
 * Before D-22, `grep` across `src/` and `tests/` found **nothing** selecting either landmark name
 * and **no test asserting either heading's text**. So there was nothing to re-point — **and nothing
 * that would have noticed the change regressing.** Making an unpinned change to an untested surface
 * would have swapped one silent thing for another. **These assertions are the half of D-22 that
 * makes it durable; the attribute edit alone was two lines.**
 *
 * ⚠️ **The safety condition D-22 attached, checked before building rather than assumed:** an
 * `aria-labelledby` pointing at an element that did not render leaves the landmark with **no name at
 * all**, which is worse than a mismatched one. Both `h2`s are unconditional — direct children of
 * their `<section>`, no ternary, no guard. The conditional content sits *below* each heading.
 *
 * ⚠️ **POPULATION.** The `WardScreen` component in jsdom at one viewport, over several seeded units.
 * Silent about layout, about what a browser paints, and about how any real screen reader announces
 * a region — jsdom computes the accessible name, it does not speak it.
 */

/** Each panel, by the words its heading is built from. The ward's own name is interpolated into
 *  both, which is exactly why a hand-written label could not track them. */
const FOLDED_PANELS = [
  { prefix: "Withdrawn from", retiredLabel: "Withdrawn referrals" },
  { prefix: "Overrides recorded against", retiredLabel: "Overrides recorded against this ward" },
] as const;

function renderWard(unitId: string) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardScreen unitId={unitId} />
    </WardFlowProvider>,
  );
}

describe("the ward screen names each folded panel once, not twice", () => {
  const walked = allUnits().slice(0, 3);

  it("has several distinctly-named units to walk, so nothing below is vacuous", () => {
    expect(walked.length, "too few units to walk").toBeGreaterThan(1);
    expect(
      new Set(walked.map((unit) => unit.name)).size,
      "the walked units share a name, so a label hard-coded to one ward could not be caught",
    ).toBe(walked.length);
  });

  it("gives each panel a landmark whose accessible name IS its heading, ward name and all", () => {
    for (const unit of walked) {
      renderWard(unit.id);

      for (const { prefix } of FOLDED_PANELS) {
        const expected = `${prefix} ${unit.name}`;
        const region = screen.getByRole("region", { name: expected });
        expect(
          region,
          `no landmark on ${unit.name} is named "${expected}" — the label and the heading have come apart again`,
        ).toBeInTheDocument();

        // 🔴 The two layers are ONE string, and this is what proves it rather than assuming it:
        // the region's accessible name is read back and compared against the heading's own text.
        // A second `aria-label` reinstated alongside would win over `aria-labelledby` and fail here.
        const heading = screen.getByRole("heading", { name: expected });
        expect(
          region.getAttribute("aria-labelledby"),
          `${unit.name}'s "${prefix}" panel is not named BY its heading — something is naming it separately`,
        ).toBe(heading.getAttribute("id"));
        expect(
          region.hasAttribute("aria-label"),
          `${unit.name}'s "${prefix}" panel has both an aria-label and aria-labelledby — the label wins, ` +
            "and the two can drift apart again",
        ).toBe(false);
      }

      cleanup();
    }
  });

  it("carries neither retired hand-written label, on any ward", () => {
    for (const unit of walked) {
      const { container } = renderWard(unit.id);

      for (const { retiredLabel } of FOLDED_PANELS) {
        expect(
          container.querySelector(`[aria-label="${retiredLabel}"]`),
          `"${retiredLabel}" is the pre-D-22 hand-written label and it still names a landmark on ${unit.name}`,
        ).toBeNull();
      }

      cleanup();
    }
  });

  it("keeps every heading id unique, since a duplicate would silently mis-name a landmark", () => {
    renderWard(walked[0].id);

    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
    const duplicated = ids.filter((id, index) => ids.indexOf(id) !== index);
    expect(
      duplicated,
      `duplicate id(s) on the ward screen: ${duplicated.join(", ")}. An aria-labelledby resolves to the ` +
        "FIRST match, so a duplicate points a landmark at the wrong element and nothing looks broken.",
    ).toEqual([]);
  });
});
