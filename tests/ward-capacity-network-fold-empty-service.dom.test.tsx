import { render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * 🔴 **A HEALTH SERVICE WITH NO REPORTING UNIT RENDERS A SENTENCE, NEVER A HEADING OVER NOTHING.**
 *
 * Every service in `wardServiceOrder` but CAHS has real units in the seeded fixture — WACHS has
 * four, Private has two (see the anti-vacuity floor in `ward-capacity-network-fold.dom.test.tsx`).
 * CAHS is empty on the live data since 2026-09-25; this file empties a service that DOES have
 * units, which the live fixture cannot produce. `ward-capacity-freshness-source.dom.test.tsx`
 * faced the same problem for a feed-sourced unit and solved it the same way: mock `useWardFlow` to
 * construct the state a real dispatch cannot produce, in a FILE OF ITS OWN, because `vi.mock`
 * hoists to the top of whatever file it is written in and would silently replace the real
 * `WardFlowProvider` for every other test sharing that file.
 *
 * The October 2026 redesign removed the network ward table whose service fold this file first
 * pinned; the fold is the bed map's service groups now (`capacity-bed-map-cards.tsx`). An empty ward
 * group is a real, expected state (a service genuinely reporting nothing today), never an error and
 * never a heading over nothing — `groupBedMapWardsByService` keeps it as an empty group for exactly
 * that reason, so the map can say so in words.
 */
vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  return {
    ...actual,
    useWardFlow: () => mockContext,
    useWardFlowSelect: () => mockContext,
    useOptionalWardFlowSelect: () => mockContext,
    useDueSoonThresholds: () => dueSoonThresholdsOf(mockContext?.configuration),
    useWardNetwork: () => activeWardNetwork(),
    useWardFlowClock: () => mockContext.now,
    useWardClock: () => mockContext.now,
  };
});

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { wardServiceOrder } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { activeWardNetwork, NOW_ANCHOR, siteByCode } from "@/components/ward-management/ward-sites";
import { bedMapCards, bedMapGroup, bedMapGroupToggle, bedMapRegion } from "./helpers/capacity-ward-table";

import { dueSoonThresholdsOf } from "@/components/ward-management/ward-clock";
const DROPPED_SERVICE = "Private";

/*
 * 🔴 **SPREAD THE SEEDED STATE; NEVER HAND-LIST THE CONTEXT'S FIELDS.**
 *
 * This mock used to declare nine fields by name. The context has around twenty. It passed here
 * only because nothing this screen rendered happened to read the other eleven — and it FAILED on
 * the integration line, where it does, with two of this file's three cases red and no clue in the
 * message as to why. A hand-listed mock is a snapshot of a shape that grows without it.
 *
 * ⚠️ THE TELL IS THAT THE FAILURE APPEARS NOWHERE NEAR THE CAUSE. Nothing in this file changed,
 * nothing in `capacity-screen.tsx` or `capacity-derivations.ts` changed — verified byte-identical
 * across the two lines — and it still went red, because a field this mock never supplied started
 * being read somewhere beneath the screen.
 *
 * `ward-capacity-freshness-source.dom.test.tsx` already had this right and this file did not copy
 * it: spread `seedWardFlowState()` and override only what the case is actually about. Two other
 * test files mock this provider; whether they hand-list is not swept here, and is handed over.
 */
const seeded = seedWardFlowState();
const unitsMissingOneService = seeded.units.filter((unit) => siteByCode(unit.siteCode)?.service !== DROPPED_SERVICE);

const mockContext = {
  ...seeded,
  units: unitsMissingOneService,
  now: NOW_ANCHOR,
  dispatch: vi.fn(),
  focusMovementId: undefined,
  setFocusMovementId: vi.fn(),
};

describe("a health service with no reporting unit renders a sentence, never a heading over nothing", () => {
  it("has actually removed every unit for the dropped service, and the real fixture had some to drop", () => {
    expect(
      unitsMissingOneService.some((unit) => siteByCode(unit.siteCode)?.service === DROPPED_SERVICE),
      `a unit from "${DROPPED_SERVICE}" survived the filter — this test's premise is false`,
    ).toBe(false);
    expect(
      seeded.units.some((unit) => siteByCode(unit.siteCode)?.service === DROPPED_SERVICE),
      `"${DROPPED_SERVICE}" had no units in the real fixture to begin with — nothing was dropped`,
    ).toBe(true);
  });

  it(`draws no group, heading or fold button over "${DROPPED_SERVICE}"`, () => {
    render(<CapacityScreen />);
    // A heading over nothing reads as a category that exists and is fine, which is exactly the
    // failure `WardGroupHeading` throws on.
    expect(bedMapGroup(DROPPED_SERVICE)).toBeNull();
    expect(within(bedMapRegion()).queryByRole("heading", { name: new RegExp(DROPPED_SERVICE, "u") })).toBeNull();
  });

  /**
   * 🔴 Fails on the redesign as first built: `BedMapCards` (`capacity-bed-map-cards.tsx`) returns
   * nothing for a group with no wards, so an empty service simply vanishes from the map — the "a
   * unit missing reads as no such bed exists" failure `groupBedMapWardsByService`'s own doc comment
   * keeps empty groups for. The old network table and `BedMap` both stated it in words. Left
   * failing for the owner to rule on, not retired.
   */
  it(`states "${DROPPED_SERVICE}" in words on the bed map`, () => {
    render(<CapacityScreen />);
    expect(bedMapRegion()).toHaveTextContent(`${DROPPED_SERVICE} has no inpatient unit reporting to this board.`);
  });

  it("still folds every other, populated service normally", () => {
    render(<CapacityScreen />);
    // CAHS has no unit in the real fixture (Perth Children's, owner ruling 2026-09-25), so it was
    // never a populated service to keep folding.
    const emptyInFixture = wardServiceOrder.filter(
      (service) => !seeded.units.some((unit) => siteByCode(unit.siteCode)?.service === service),
    );
    expect(emptyInFixture).toEqual(["CAHS"]);
    const remaining = wardServiceOrder.filter((service) => service !== DROPPED_SERVICE && service !== "CAHS");
    expect(remaining.length, "no other services left to check — this floor would be vacuous").toBeGreaterThan(0);
    for (const service of remaining) {
      const group = bedMapGroup(service);
      expect(group, `${service} lost its group once a sibling service emptied`).not.toBeNull();
      const toggle = bedMapGroupToggle(group!);
      expect(toggle, `${service} lost its fold button once a sibling service emptied`).toHaveAttribute("aria-expanded");
      expect(bedMapCards(group!).length, `${service} lost its wards once a sibling service emptied`).toBe(
        seeded.units.filter((unit) => siteByCode(unit.siteCode)?.service === service).length,
      );
    }
  });
});
