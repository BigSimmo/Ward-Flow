import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { bedMapWards, groupBedMapWardsByService } from "@/components/ward-management/capacity/bed-map";
import { BedMapCards } from "@/components/ward-management/capacity/capacity-bed-map-cards";
import { networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
import type { CapacityModel } from "@/components/ward-management/capacity/capacity-model";
import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { CapacityWardSidebar } from "@/components/ward-management/capacity/capacity-ward-drawer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { bedMapCards, bedMapGroup, bedMapRegion, bedSquares, bedSquaresOf } from "./helpers/capacity-ward-table";

/**
 * Capacity's bed map (`capacity-bed-map-cards.tsx`, the October 2026 redesign): every ward as a
 * card with one square per bed, grouped by health service. The squares are decorative and the
 * card says the same in words; pressing a card opens the ward drawer.
 *
 * Every expected figure is read from `bedMapWards` / `networkWardRows` over the same state the map
 * draws, never hand-written. The old `BedMap` component's hatch, carousel, service shortcuts and
 * per-square links went with the redesign; their cases were retired with it.
 */
type MapState = Pick<WardFlowState, "units" | "bedReleases" | "admissions" | "leaveBeds">;

const seeded = seedWardFlowState();
const seededWards = bedMapWards(seeded.units, [...seeded.bedReleases], seeded.admissions, seeded.leaveBeds);
const seededGroups = groupBedMapWardsByService(seededWards);

/** The three fields of the page model that `BedMapCards` reads, built from the given state. */
function mapModel(state: MapState): CapacityModel {
  const model: Pick<CapacityModel, "mapGroups" | "networkRows" | "now"> = {
    mapGroups: groupBedMapWardsByService(
      bedMapWards(state.units, [...state.bedReleases], state.admissions, state.leaveBeds),
    ),
    networkRows: networkWardRows(state.units, NOW_ANCHOR, state.bedReleases, state.admissions, state.leaveBeds),
    now: NOW_ANCHOR,
  };
  return model as CapacityModel;
}

function renderMap(state: MapState, onSelectWard: (unitId: string) => void = vi.fn()) {
  return render(
    <BedMapCards model={mapModel(state)} onSelectWard={onSelectWard} highlight={null} onHighlight={vi.fn()} />,
  );
}

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CapacityScreen />
    </WardFlowProvider>,
  );
}

/** Each ward's card, paired with its derived figures by the group order both share. */
function cardsByWard(groups = seededGroups) {
  return groups.flatMap((group) => {
    if (group.wards.length === 0) return [];
    const section = bedMapGroup(group.service);
    expect(section, `${group.service} has wards but no group on the map`).not.toBeNull();
    const cards = bedMapCards(section!);
    expect(cards, `${group.service} draws a different number of cards than it has wards`).toHaveLength(
      group.wards.length,
    );
    return group.wards.map((ward, index) => ({ ward, card: cards[index]! }));
  });
}

afterEach(() => {
  window.sessionStorage.clear();
});

describe("Capacity bed map — the network's whole bed supply, one square per bed", () => {
  it("has a non-empty population to render, or every assertion below is vacuous", () => {
    expect(seededWards.length).toBeGreaterThan(0);
  });

  /**
   * The map must draw exactly as many squares of each kind as the derivations report, per ward —
   * walked over every real unit, not one hand-picked example. Pulled beds share the occupied
   * square ("Occupied or pulled") since the redesign.
   */
  it("draws exactly as many squares of each kind as bedStates reports, for every ward", () => {
    expect(
      seededWards.reduce((sum, ward) => sum + ward.pulled, 0),
      "no ward has a pulled bed — the pulled half of the occupied squares is untested",
    ).toBeGreaterThan(0);
    renderScreen();
    for (const { ward, card } of cardsByWard()) {
      expect(bedSquaresOf(card, "ready"), ward.unit.id).toHaveLength(ward.ready);
      expect(bedSquaresOf(card, "used"), ward.unit.id).toHaveLength(ward.occupied + ward.pulled);
      expect(bedSquaresOf(card, "closed"), ward.unit.id).toHaveLength(ward.closed);
      expect(bedSquares(card), `${ward.unit.id}: drawn squares do not sum to its ${ward.unit.beds} beds`).toHaveLength(
        ward.unit.beds,
      );
    }
  });

  it("states every bed still being made ready in words, and never takes it off the ready squares", () => {
    const preparing = seededWards.filter((ward) => ward.pendingPreparation > 0);
    expect(preparing.length, "no ward has a bed pending preparation — this guard proves nothing").toBeGreaterThan(0);
    renderScreen();
    for (const { ward, card } of cardsByWard()) {
      if (ward.pendingPreparation > 0) {
        expect(card, ward.unit.id).toHaveTextContent(`${ward.pendingPreparation} being made ready`);
      } else {
        expect(card.textContent ?? "", ward.unit.id).not.toMatch(/being made ready/u);
      }
      // Owner ruling 2026-09-05: a bed being cleaned is never subtracted from Ready.
      expect(bedSquaresOf(card, "ready"), ward.unit.id).toHaveLength(ward.ready);
    }
  });

  /**
   * A service with nothing in it is never headed over an empty group. Proved on a MINIMAL synthetic
   * network built for the purpose (WACHS removed). That such a service is also stated in words is
   * pinned in `ward-capacity-network-fold-empty-service.dom.test.tsx`.
   */
  it("never heads an empty service group", () => {
    const withoutWachs = seeded.units.filter((unit) => {
      // WACHS units in today's fixture: Albany, Bunbury, Broome, Geraldton.
      return !["alb-adult-open", "bun-adult-open", "brm-adult-secure", "ger-adult-open"].includes(unit.id);
    });
    expect(withoutWachs.length, "removed too many units — this fixture would be vacuous").toBeLessThan(
      seeded.units.length,
    );
    const groups = groupBedMapWardsByService(bedMapWards(withoutWachs, [...seeded.bedReleases]));
    expect(
      groups.find((group) => group.service === "WACHS")?.wards.length,
      "the synthetic fixture still has a WACHS unit",
    ).toBe(0);

    renderMap({ ...seeded, units: withoutWachs });
    expect(screen.queryByRole("heading", { name: /WACHS/u }), "an empty service must not be headed").toBeNull();
    expect(bedMapGroup("WACHS")).toBeNull();
  });

  /** The other half, against the REAL fixture: today WACHS is not empty, so it is a normal group. */
  it("renders WACHS as a normal heading with real ward cards in today's fixture", () => {
    renderScreen();
    const wachs = seededGroups.find((group) => group.service === "WACHS")!;
    expect(wachs.wards.length, "WACHS has no ward in today's fixture").toBeGreaterThan(0);
    const section = bedMapGroup("WACHS");
    expect(section).not.toBeNull();
    expect(within(section!).getByRole("heading", { name: /WACHS/u })).toBeInTheDocument();
    expect(bedMapCards(section!)).toHaveLength(wachs.wards.length);
  });

  it("names every kind of square in the bed map key, and no Held or Blocked square", () => {
    renderScreen();
    const legend = within(bedMapRegion()).getByLabelText("Bed map key");
    expect(within(legend).getByText(/^Ready$/u)).toBeInTheDocument();
    expect(within(legend).getByText(/^Occupied or pulled$/u)).toBeInTheDocument();
    expect(within(legend).getByText(/^Closed$/u)).toBeInTheDocument();
    // "Held" means only a bed kept for a patient on leave, which is never a square of its own.
    expect(within(legend).queryByText(/Held|Blocked/u)).toBeNull();
  });

  it("hides the decorative squares from assistive technology and states each ward's beds in words", () => {
    renderScreen();
    for (const { ward, card } of cardsByWard()) {
      const strip = card.querySelector("i")?.parentElement;
      expect(strip, ward.unit.id).toHaveAttribute("aria-hidden", "true");
      expect(card.textContent ?? "", ward.unit.id).toMatch(new RegExp(`${ward.ready || "None"}\\s*ready`, "u"));
      expect(card, ward.unit.id).toHaveTextContent(`${ward.occupied + ward.pulled} of ${ward.unit.beds} occupied`);
    }
  });

  /**
   * ⚠️ ZERO READS "none", NEVER "0" — the rule this whole screen applies to Ready and Locked
   * (`ward-capacity-zero-spelling.dom.test.tsx`, census §8). Floored on a real ward actually having
   * a zero ready count so the word branch is exercised against real data.
   *
   * 🔴 Fails on the redesign as first built: `WardCard` in `capacity-bed-map-cards.tsx` draws the
   * bare figure (`<b>{ward.ready}</b> ready`). Left failing for the owner to rule on, not retired.
   */
  it("states a ward's zero ready count as 'none', never a bare '0'", () => {
    const zeroReady = seededWards.filter((ward) => ward.ready === 0);
    expect(zeroReady.length, "no ward has a zero ready count — this guard proves nothing").toBeGreaterThan(0);
    renderScreen();
    for (const { ward, card } of cardsByWard()) {
      if (ward.ready !== 0) continue;
      expect(card, ward.unit.id).toHaveTextContent(/none ready/iu);
      expect(card.textContent ?? "", `${ward.unit.id} kept a bare 0 beside "ready"`).not.toMatch(/\b0\s*ready/u);
    }
  });

  it("calls onSelectWard with the ward's own id when its card is pressed", () => {
    const onSelectWard = vi.fn();
    renderMap(seeded, onSelectWard);
    const [{ ward, card }] = cardsByWard();
    fireEvent.click(card);
    expect(onSelectWard).toHaveBeenCalledOnce();
    expect(onSelectWard).toHaveBeenCalledWith(ward.unit.id);
  });

  it("makes every ward card a keyboard-reachable button that opens the ward drawer", async () => {
    renderScreen();
    const user = userEvent.setup();
    const cards = cardsByWard();
    for (const { card } of cards) {
      expect(card.tagName).toBe("BUTTON");
      expect(card).toHaveAttribute("type", "button");
      expect(card).toHaveAttribute("aria-haspopup", "dialog");
    }
    const [{ ward, card }] = cards;
    card.focus();
    await user.keyboard("{Enter}");
    const drawer = screen.getByTestId("ward-capacity-ward-drawer");
    expect(within(drawer).getByRole("link", { name: "Open ward" })).toHaveAttribute(
      "href",
      `/ward-flow/ward/${ward.unit.id}`,
    );
  });
});

describe("valid capacity observations with ongoing preparation", () => {
  it("draws zero ready squares and states the actual preparation record, without extra squares", () => {
    const state = seedWardFlowState();
    const release = state.bedReleases.find((row) => row.state === "discharged" && row.preparing)!;
    const unit = state.units.find((row) => row.id === release.unitId)!;
    const next = wardFlowReducer(state, {
      type: "CONFIRM_CAPACITY",
      role: "ward",
      now: NOW_ANCHOR,
      unitId: unit.id,
      actingUnitId: unit.id,
      value: 0,
      expectedRevision: unit.allocatable.revision ?? 0,
    });
    expect(next.rejections).toEqual([]);
    const nextWards = bedMapWards(next.units, [...next.bedReleases], next.admissions, next.leaveBeds);
    const ward = nextWards.find((entry) => entry.unit.id === unit.id)!;
    expect(ward.ready).toBe(0);
    expect(ward.pendingPreparation).toBeGreaterThan(0);

    renderMap(next);
    const { card } = cardsByWard(groupBedMapWardsByService(nextWards)).find((entry) => entry.ward.unit.id === unit.id)!;
    expect(bedSquaresOf(card, "ready")).toHaveLength(0);
    expect(bedSquares(card)).toHaveLength(unit.beds);
    expect(card).toHaveTextContent(`${ward.pendingPreparation} being made ready`);
  });

  it("states an arrival awaiting reconciliation in the ward drawer, without a physical overflow square", () => {
    const state = seedWardFlowState();
    const unit = state.units[0]!;
    const observed = { ...unit, arrivalCapacityConflicts: [{ movementId: "SYN-ARRIVAL", at: NOW_ANCHOR }] };
    const [row] = networkWardRows([observed], NOW_ANCHOR, state.bedReleases, state.admissions, state.leaveBeds);
    expect(row!.arrivalCapacityConflicts).toBe(1);

    renderMap({ ...state, units: [observed] });
    expect(bedSquares(bedMapCards()[0]!)).toHaveLength(unit.beds);

    const { container } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityWardSidebar row={row!} onBack={vi.fn()} now={NOW_ANCHOR} />
      </WardFlowProvider>,
    );
    const beds = within(container).getByRole("region", { name: "Beds now" });
    expect(bedSquares(beds)).toHaveLength(unit.beds);
    expect(container).toHaveTextContent("1 arrival(s) awaiting capacity reconciliation.");
  });
});
