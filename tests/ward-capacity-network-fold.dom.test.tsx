import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { bedMapWards, groupBedMapWardsByService } from "@/components/ward-management/capacity/bed-map";
import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import {
  groupNetworkWardRowsByService,
  networkWardRows,
} from "@/components/ward-management/capacity/capacity-derivations";
import { wardServiceOrder } from "@/components/ward-management/ward-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR, siteByCode } from "@/components/ward-management/ward-sites";
import {
  bedMapCards,
  bedMapGroup,
  bedMapGroupToggle,
  bedSquares,
  bedSquaresOf,
  wardCardName,
} from "./helpers/capacity-ward-table";

/**
 * Capacity's wards folded by health service.
 *
 * The October 2026 redesign (Josh, 31 Oct 2026) removed the network ward table and its
 * service-folded summary rows; every ward as a table lives on All wards now. The fold moved to the
 * bed map: each health service is a group whose heading is a fold button stating the group's own
 * ward count, ready beds, closed beds and share in use. This file pins that fold.
 *
 * 🔴 **THE TOTALS ARE CHECKED A SECOND, INDEPENDENT WAY — FROM THE SQUARES THE MAP ACTUALLY DREW.**
 * This file once built its expected totals by calling the same function the summary row called, so
 * a bug inside it could not be seen from here. The group heading's figures are summed in
 * `capacity-bed-map-cards.tsx` from `networkWardRows` (ready) and `bedMapWards` (closed, in use);
 * the test reads each ward card's squares back from the DOM and sums them by hand. No single
 * mistake can move both.
 *
 * ⚠️ **What still legitimately comes from production code, and why it is not the same fault.**
 * `groupBedMapWardsByService` and `groupNetworkWardRowsByService` decide *which services exist and
 * which wards belong to them* — the iteration, not the arithmetic. That partition is independently
 * checked in the first describe block below against `siteByCode`.
 */
const seeded = seedWardFlowState();
const networkRows = networkWardRows(seeded.units, NOW_ANCHOR, seeded.bedReleases, seeded.admissions, seeded.leaveBeds);
const groups = groupNetworkWardRowsByService(networkRows);
const mapGroups = groupBedMapWardsByService(
  bedMapWards(seeded.units, [...seeded.bedReleases], seeded.admissions, seeded.leaveBeds),
);
/**
 * The one service with no ward in the live fixture. Perth Children's moved under CAHS (owner ruling
 * 2026-09-25), and it has an emergency department and no adult mental health ward. Every totals
 * test below walks the populated services; the first test pins that CAHS is the only empty one.
 */
const EMPTY_SERVICE = "CAHS";
const populatedGroups = mapGroups.filter((group) => group.wards.length > 0);
/** The bed map opens the first two services on first view and folds the rest. */
const OPEN_ON_FIRST_VIEW = new Set(mapGroups.slice(0, 2).map((group) => group.service));

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CapacityScreen />
    </WardFlowProvider>,
  );
}

function groupOf(service: string): HTMLElement {
  const group = bedMapGroup(service);
  expect(group, `no bed map group rendered for ${service}`).not.toBeNull();
  return group!;
}

function panelOf(service: string): HTMLElement {
  const toggle = bedMapGroupToggle(groupOf(service));
  const panel = document.getElementById(toggle.getAttribute("aria-controls") ?? "");
  expect(panel, `${service}'s fold panel is not in the document`).not.toBeNull();
  return panel!;
}

/** "3 ready · 1 closed · 85% in use", read back as numbers from the group's fold button. */
function readHeading(service: string): { ready: number; closed: number; inUse: number } {
  const text = (bedMapGroupToggle(groupOf(service)).textContent ?? "").replace(/\s+/gu, " ");
  const match = /(\d+) ready · (\d+) closed · (\d+)% in use/u.exec(text);
  expect(match, `${service}'s heading rendered "${text}" — not "N ready · N closed · N% in use"`).not.toBeNull();
  return { ready: Number(match![1]), closed: Number(match![2]), inUse: Number(match![3]) };
}

afterEach(() => {
  window.sessionStorage.clear();
});

describe("Capacity's wards walk every health service, or the suite below is vacuous", () => {
  it("has all six services, every one but CAHS with real wards in the live fixture, summing to the whole board", () => {
    expect(groups.length, "groupNetworkWardRowsByService did not return one entry per wardServiceOrder").toBe(
      wardServiceOrder.length,
    );
    expect(groups.map((group) => group.service)).toEqual([...wardServiceOrder]);
    expect(mapGroups.map((group) => group.service)).toEqual([...wardServiceOrder]);

    expect(
      groups.filter((group) => group.wards.length === 0).map((group) => group.service),
      "a service other than CAHS has no wards in the live fixture, or CAHS gained one",
    ).toEqual([EMPTY_SERVICE]);
    expect(
      populatedGroups.length,
      "no service has any wards in the live fixture — every totals assertion below would be vacuous",
    ).toBe(groups.length - 1);

    const totalWards = groups.reduce((sum, group) => sum + group.wards.length, 0);
    expect(totalWards, "the groups do not partition every network row exactly once").toBe(networkRows.length);
  });

  it("never assigns a ward to the wrong service or to two groups, and the map agrees with the rows", () => {
    for (const group of groups) {
      for (const row of group.wards) {
        const site = siteByCode(row.unit.siteCode);
        expect(site, `${row.unit.id} has no resolvable site`).not.toBeUndefined();
        expect(site?.service, `${row.unit.id} landed in the "${group.service}" group`).toBe(group.service);
      }
    }
    const seen = new Set<string>();
    for (const group of groups) {
      for (const row of group.wards) {
        expect(seen.has(row.unit.id), `${row.unit.id} appears in more than one service group`).toBe(false);
        seen.add(row.unit.id);
      }
    }
    // The bed map groups its cards with `groupBedMapWardsByService`; a ward must sit in the same
    // service there as in the rows its heading totals are read from.
    for (const [index, group] of groups.entries()) {
      expect(
        mapGroups[index]!.wards.map((ward) => ward.unit.id),
        `${group.service} holds different wards on the bed map`,
      ).toEqual(group.wards.map((row) => row.unit.id));
    }
  });
});

describe("a service group's heading states its own totals, never the network's", () => {
  it("renders a fold button per populated service, the first two open, naming its ward count", () => {
    renderScreen();
    // The empty service has no group and no fold button: a heading over nothing reads as a
    // category that exists and is fine. That it is stated in words instead is pinned in
    // ward-capacity-network-fold-empty-service.dom.test.tsx.
    expect(bedMapGroup(EMPTY_SERVICE)).toBeNull();
    for (const group of populatedGroups) {
      const toggle = bedMapGroupToggle(groupOf(group.service));
      expect(toggle, `${group.service}'s fold button`).toHaveAttribute(
        "aria-expanded",
        OPEN_ON_FIRST_VIEW.has(group.service) ? "true" : "false",
      );
      // ⚠️ Present in the DOM whether open or shut, so aria-controls always resolves.
      const panel = panelOf(group.service);
      expect(panel.hidden, `${group.service}'s panel visibility disagrees with its button`).toBe(
        !OPEN_ON_FIRST_VIEW.has(group.service),
      );
      expect(toggle, `${group.service}'s heading does not state its own ward count`).toHaveTextContent(
        `${group.wards.length} wards`,
      );
    }
  });

  /**
   * ⚠️ **THE ASSERTION THIS WHOLE FILE IS FOR.** Every expected figure is summed from the group's
   * OWN ward cards as drawn. Floored three ways, because a totals test is the easiest kind to
   * satisfy vacuously:
   *   1. every group draws at least one ward card (otherwise every sum is 0 === 0);
   *   2. at least one figure somewhere is non-zero;
   *   3. at least one group's Ready differs from the whole network's — without which a mutant
   *      reading the network figure on every group would still pass.
   */
  it("agrees, figure by figure, with an independent sum of its own wards' drawn squares", () => {
    renderScreen();
    let sawANonZeroTotal = false;
    const readyByGroup: number[] = [];

    for (const group of populatedGroups) {
      const service = group.service;
      const cards = bedMapCards(panelOf(service));
      expect(cards.length, `${service}'s fold draws no ward card — every total would be vacuous`).toBeGreaterThan(0);
      expect(cards, `${service}'s heading count and its cards disagree`).toHaveLength(group.wards.length);

      const sum = (kind: "ready" | "used" | "closed") =>
        cards.reduce((total, card) => total + bedSquaresOf(card, kind).length, 0);
      const beds = cards.reduce((total, card) => total + bedSquares(card).length, 0);
      const expectedReady = sum("ready");
      const expectedClosed = sum("closed");
      const expectedInUse = beds ? Math.round((sum("used") / beds) * 100) : 0;

      const heading = readHeading(service);
      expect(heading.ready, `${service}'s Ready total`).toBe(expectedReady);
      expect(heading.closed, `${service}'s Closed total`).toBe(expectedClosed);
      expect(heading.inUse, `${service}'s share in use`).toBe(expectedInUse);

      readyByGroup.push(expectedReady);
      if (expectedReady > 0 || expectedClosed > 0 || expectedInUse > 0) sawANonZeroTotal = true;
    }

    expect(sawANonZeroTotal, "every group totalled nought — this suite cannot tell a real sum from a stub").toBe(true);
    const networkReady = readyByGroup.reduce((total, value) => total + value, 0);
    expect(
      readyByGroup.some((value) => value !== networkReady),
      "every group's Ready total equals the whole network's — this suite cannot tell a correct " +
        "group sum from one that reads the network total instead",
    ).toBe(true);
  });
});

describe("expanding a service reveals exactly its own wards, and no others", () => {
  it("puts only that service's own wards inside the fold it controls", () => {
    renderScreen();
    for (const group of populatedGroups) {
      const drawn = bedMapCards(panelOf(group.service)).map(wardCardName);
      expect(drawn, `${group.service}'s fold holds a different set of wards`).toEqual(
        group.wards.map((ward) => ward.unit.name),
      );
    }
  });

  it("toggles aria-expanded and the panel on click, independently per service", () => {
    renderScreen();
    const [first, second] = populatedGroups;
    expect(first, "need at least two populated services for this test to prove independence").toBeDefined();
    expect(second, "need at least two populated services for this test to prove independence").toBeDefined();
    expect(OPEN_ON_FIRST_VIEW.has(first!.service) && OPEN_ON_FIRST_VIEW.has(second!.service)).toBe(true);

    const firstButton = bedMapGroupToggle(groupOf(first!.service));
    const secondButton = bedMapGroupToggle(groupOf(second!.service));

    fireEvent.click(firstButton);
    expect(firstButton).toHaveAttribute("aria-expanded", "false");
    expect(panelOf(first!.service).hidden).toBe(true);
    expect(secondButton, "closing one service also closed another").toHaveAttribute("aria-expanded", "true");
    expect(panelOf(second!.service).hidden).toBe(false);

    fireEvent.click(firstButton);
    expect(firstButton).toHaveAttribute("aria-expanded", "true");
    expect(panelOf(first!.service).hidden).toBe(false);
  });

  it("operates on both Enter and Space, like any native button", async () => {
    renderScreen();
    const user = userEvent.setup();
    const button = within(groupOf(populatedGroups[0]!.service)).getByRole("button", { expanded: true });

    button.focus();
    await user.keyboard("{Enter}");
    expect(button).toHaveAttribute("aria-expanded", "false");

    await user.keyboard(" ");
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "Bed map" })).toContainElement(button);
  });
});
