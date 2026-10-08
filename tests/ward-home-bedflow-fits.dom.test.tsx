import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import {
  INFORMATIONAL_GATES,
  isOpen,
  needsNoRecordedReason,
  shortlistCandidates,
} from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, siteByCode } from "@/components/ward-management/ward-sites";

/**
 * Owner, 8 Oct 2026: with a patient selected, State bedflow lists every ward that patient fits at
 * the top, highlights them green where a bed is ready and amber where the ward fits but has no bed
 * now, and opens only the health services those wards are in.
 */
const NOW = NOW_ANCHOR;
const MOVEMENT_ID = "WF-030";

function expectedFits(movementId: string) {
  const state = seedWardFlowState();
  const movement = state.movements.find((candidate) => candidate.id === movementId)!;
  const bed = new Set<string>();
  const noBed = new Set<string>();
  for (const candidate of shortlistCandidates(movement, state.units, NOW)) {
    if (needsNoRecordedReason(candidate.availability)) {
      bed.add(candidate.unit.id);
      continue;
    }
    const failing = candidate.verdict.gates.filter((gate) => !gate.pass && !INFORMATIONAL_GATES.includes(gate.gate));
    if (
      candidate.availability === "unavailable" &&
      failing.length > 0 &&
      failing.every((gate) => gate.gate === "allocatable_bed")
    ) {
      noBed.add(candidate.unit.id);
    }
  }
  return { bed, noBed };
}

describe("State bedflow's fitting wards for the selected patient", () => {
  it("lists, highlights and opens exactly the wards and services the patient fits", () => {
    const { bed, noBed } = expectedFits(MOVEMENT_ID);
    // The fixture must exercise both colours, or this test proves only one of them.
    expect(bed.size).toBeGreaterThan(0);
    expect(noBed.size).toBeGreaterThan(0);

    render(
      <WardFlowProvider initialNow={NOW}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId(`ward-queue-row-${MOVEMENT_ID}`));

    const bedflow = screen.getByRole("region", { name: "State Bedflow" });
    const options = within(within(bedflow).getByTestId("ward-bedflow-options")).getAllByRole("button");
    expect(options).toHaveLength(bed.size + noBed.size);
    expect(options.filter((option) => option.dataset.fit === "bed")).toHaveLength(bed.size);
    expect(options.filter((option) => option.dataset.fit === "no-bed")).toHaveLength(noBed.size);

    for (const unitId of noBed) {
      const row = within(bedflow).getByTestId(`ward-diagram-unit-${unitId}`).closest("li")!;
      expect(row).toHaveAttribute("data-highlight", "fit-no-bed");
      expect(row).toHaveTextContent("Fits, no bed now");
    }
  });

  it("opens only the health services holding a ward the patient fits", () => {
    // A patient whose fits sit in some services but not all, so both halves of the rule run.
    const state = seedWardFlowState();
    const serviceOf = (unitId: string) => siteByCode(state.units.find((unit) => unit.id === unitId)!.siteCode)?.service;
    const allServices = new Set(state.units.map((unit) => serviceOf(unit.id)));
    const movement = state.movements.find((candidate) => {
      if (!isOpen(candidate) || candidate.acceptedUnitId || candidate.referredUnitIds.length > 0) return false;
      const { bed, noBed } = expectedFits(candidate.id);
      const services = new Set([...bed, ...noBed].map(serviceOf));
      return bed.size > 0 && services.size < allServices.size;
    })!;
    expect(movement).toBeDefined();
    const { bed, noBed } = expectedFits(movement.id);

    render(
      <WardFlowProvider initialNow={NOW}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId(`ward-queue-row-${movement.id}`));
    const bedflow = screen.getByRole("region", { name: "State Bedflow" });

    // Only the health services holding a fitting ward open.
    expect(within(bedflow).queryAllByRole("button", { expanded: true }).length).toBeGreaterThan(0);
    expect(within(bedflow).queryAllByRole("button", { expanded: false }).length).toBeGreaterThan(0);
    for (const group of within(bedflow).queryAllByRole("button", { expanded: true })) {
      const list = document.getElementById(group.getAttribute("aria-controls")!)!;
      const ids = Array.from(list.querySelectorAll("[data-testid^='ward-diagram-unit-']")).map((node) =>
        node.getAttribute("data-testid")!.replace("ward-diagram-unit-", ""),
      );
      expect(ids.some((id) => bed.has(id) || noBed.has(id))).toBe(true);
    }
    for (const group of within(bedflow).queryAllByRole("button", { expanded: false })) {
      const list = document.getElementById(group.getAttribute("aria-controls")!);
      if (!list) continue;
      const ids = Array.from(list.querySelectorAll("[data-testid^='ward-diagram-unit-']")).map((node) =>
        node.getAttribute("data-testid")!.replace("ward-diagram-unit-", ""),
      );
      expect(ids.some((id) => bed.has(id) || noBed.has(id))).toBe(false);
    }
  });
});
