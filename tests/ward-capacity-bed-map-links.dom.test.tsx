import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { bedMapWards, groupBedMapWardsByService } from "@/components/ward-management/capacity/bed-map";
import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { bedMapCards, bedMapGroup } from "./helpers/capacity-ward-table";

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

/**
 * Audit P093 (Josh, 9:55 PM 27 Oct 2026, option A) linked each bed-map square to its ward's bed
 * board. The October 2026 redesign made the squares decorative and the whole ward card a button
 * that opens the ward drawer, whose "Open ward" link carries that route now. This file pins that
 * every ward on the map still reaches its own ward page, and never another ward's.
 */
describe("Capacity bed map links to each ward's own page (audit P093, redesign)", () => {
  it("opens every ward's drawer from its card, with an Open ward link to that ward's page", () => {
    const seeded = seedWardFlowState();
    const groups = groupBedMapWardsByService(
      bedMapWards(seeded.units, [...seeded.bedReleases], seeded.admissions, seeded.leaveBeds),
    );
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityScreen />
      </WardFlowProvider>,
    );
    let checked = 0;
    for (const group of groups) {
      if (group.wards.length === 0) continue;
      const cards = bedMapCards(bedMapGroup(group.service)!);
      expect(cards, group.service).toHaveLength(group.wards.length);
      group.wards.forEach((ward, index) => {
        fireEvent.click(cards[index]!);
        const drawer = screen.getByTestId("ward-capacity-ward-drawer");
        expect(drawer, ward.unit.id).toHaveTextContent(ward.unit.name);
        expect(within(drawer).getByRole("link", { name: "Open ward" }), ward.unit.id).toHaveAttribute(
          "href",
          `/ward-flow/ward/${ward.unit.id}`,
        );
        checked += 1;
      });
    }
    expect(checked, "no ward card was checked").toBe(seeded.units.length);
  });
});
