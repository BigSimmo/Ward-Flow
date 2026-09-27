/**
 * 🔴 **RETIRED 2026-09-06 — OWNER RULING: THE ELEVEN REPLACED WARD SCREENS ARE FINISHED WITH.**
 *
 * `LiveTracker` is reached by no route. These 2 cases are skipped, not deleted: the
 * source stays, and every case's own words are recorded in
 * `docs/ward-flow/retired-coverage-record-2026-09-06.md` so the cover is recoverable if the
 * screen is ever revived. ⚠️ **A retired test with no record of its subject is a deletion
 * wearing a softer word.**
 *
 * ⚠️ **THE COMPONENT IS NOT DELETED BY THIS RULING, AND THAT IS DELIBERATE.** This repository
 * forbids removing an exported symbol on a "nothing imports it" basis, and three of the defects
 * found on 2026-09-06 were held in place BY unreachability — which is more fragile than a live
 * defect, not less. **An unreachable wrong screen is a fix, not a delete.** What closes here is
 * the false coverage, which was the actual harm.
 *
 * **Do not un-skip these to make a number go up.** `tests/ward-component-reachability.test.ts`
 * reddens if this component becomes reachable again, and that is the signal to restore cover —
 * from the record, deliberately, not by deleting a `.skip`.
 */
/**
 * ⚠️ **NO ROUTE REACHES THE SCREEN THIS FILE RENDERS.** `LiveTracker` — /transport redirects to /movements
 * (measured 2026-09-06, `docs/ward-flow/unreachable-ward-screens-2026-09-06.md`).
 *
 * **These cases passed and always would have. They were not coverage of anything a coordinator
 * could open.** ⚠️ **The line above this one used to say nothing here was skipped or retired.
 * That stopped being true on 2026-09-06 and is corrected rather than left standing.**
 *
 * ⚠️ **THIS COMMENT IS A POINTER, NOT THE GUARANTEE.** A comment saying a screen is
 * unreachable stays exactly as true-looking on the day it becomes reachable again.
 * `tests/ward-component-reachability.test.ts` holds the property: it reddens if this file
 * starts rendering a newly orphaned component, AND it reddens if the component comes back,
 * naming the declaration to delete. **If the two ever disagree, believe the guard.**
 */
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Mirrors the sibling dom suites (ward-screen.dom.test.tsx,
// ward-flow-clock-consistency.dom.test.tsx): LiveTracker renders next/link anchors and this
// suite never checks routing itself, so a plain <a> avoids requiring an App Router context
// jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { LiveTracker } from "@/components/ward-management/tracker/live-tracker";
import { isOpen, transportLeg } from "@/components/ward-management/ward-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { wardMovements } from "@/components/ward-management/ward-movements";

/**
 * Deferred item 3. Every leg badge on the tracker used to share one class (`Cancelled` had a
 * second), so the ONLY thing separating "the ward has accepted" from "the patient is physically
 * in the vehicle" was the badge text — on the one screen whose whole job is showing where a
 * patient is right now.
 *
 * This asserts the distinction is real *treatment*, not text: two rows whose legs sit either side
 * of collection must carry different classes. It deliberately says nothing about which colour,
 * because nothing here measures colour.
 *
 * Both rows are found from the real fixture rather than hard-coded, and the fixture assumption is
 * asserted first, so this fails loudly if the seed ever stops containing one of the two legs
 * rather than silently passing against a single row.
 */
function seedRowIdForLeg(leg: string): string {
  const match = wardMovements.filter(isOpen).find((movement) => transportLeg(movement.transport) === leg);
  expect(match, `fixture assumption: the seed carries an open movement at leg "${leg}"`).toBeDefined();
  return match!.id;
}

function badgeClassFor(movementId: string, leg: string): string {
  const row = screen.getByTestId(`ward-tracker-row-${movementId}`);
  const badge = Array.from(row.querySelectorAll("span")).find((element) => element.textContent === leg);
  expect(badge, `row ${movementId} renders a badge reading "${leg}"`).toBeDefined();
  return badge!.className;
}

describe.skip("live tracker leg badges", () => {
  it("gives the in-vehicle leg a different treatment from a leg before collection", () => {
    const acceptedId = seedRowIdForLeg("Accepted");
    const collectedId = seedRowIdForLeg("Collected");

    render(
      <WardFlowProvider>
        <LiveTracker />
      </WardFlowProvider>,
    );

    const acceptedClass = badgeClassFor(acceptedId, "Accepted");
    const collectedClass = badgeClassFor(collectedId, "Collected");

    // The distinction is in the class, not the label: a screen that only changed the words would
    // pass a text assertion and fail this one.
    expect(collectedClass).not.toBe(acceptedClass);
    expect(acceptedClass).not.toBe("");
    expect(collectedClass).not.toBe("");
  });

  /**
   * The narrower half of the same claim, stated for exactly what it proves: the treatment is a
   * function of the LEG, not of the row. Two rows sitting at the same leg must therefore carry
   * the identical class.
   *
   * This does not prove that no future leg gets its own colour — the seed fixture only ever
   * renders two of the six legs (`Accepted` and `Collected`; `Arrived` and `Cancelled` both close
   * their movement, which `isOpen` keeps off this screen entirely), so no browser-level test here
   * can speak to the four it never shows.
   */
  it("keys the badge treatment to the leg, not to the individual row", () => {
    const accepted = wardMovements
      .filter(isOpen)
      .filter((movement) => transportLeg(movement.transport) === "Accepted")
      .map((movement) => movement.id);
    expect(accepted.length, "fixture assumption: the seed carries more than one Accepted row").toBeGreaterThan(1);

    render(
      <WardFlowProvider>
        <LiveTracker />
      </WardFlowProvider>,
    );

    const first = badgeClassFor(accepted[0], "Accepted");
    const second = badgeClassFor(accepted[1], "Accepted");
    expect(second).toBe(first);
  });
});
