import { readFileSync } from "node:fs";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BedMap, bedMapWards, groupBedMapWardsByService } from "@/components/ward-management/capacity/bed-map";
import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { bedReleases } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

const units = allUnits();

function squaresIn(wardBlock: HTMLElement, state: "ready" | "held" | "blocked" | "occupied"): HTMLElement[] {
  return Array.from(wardBlock.querySelectorAll(`[data-bed-map-state="${state}"]`));
}

describe("BedMap — the network's whole bed supply, one square per bed", () => {
  it("has a non-empty population to render, or every assertion below is vacuous", () => {
    expect(units.length).toBeGreaterThan(0);
  });

  /**
   * ⚠️ THE FIRST TEST NAMED IN THIS TASK'S BRIEF: the map must draw exactly as many squares of each
   * state as the derivations report, per ward — walked over every real unit, not one hand-picked
   * example.
   */
  it("draws exactly as many squares of each state as unitCapacity reports, for every ward", () => {
    const expected = bedMapWards(units, bedReleases);
    render(<BedMap units={units} bedReleases={bedReleases} />);
    for (const ward of expected) {
      const block = screen.getByTestId(`ward-bed-map-ward-${ward.unit.id}`);
      expect(squaresIn(block, "ready"), ward.unit.id).toHaveLength(ward.ready);
      expect(squaresIn(block, "held"), ward.unit.id).toHaveLength(ward.held);
      expect(squaresIn(block, "blocked"), ward.unit.id).toHaveLength(ward.blocked);
      expect(squaresIn(block, "occupied"), ward.unit.id).toHaveLength(ward.occupied);
      const total = ward.ready + ward.held + ward.blocked + ward.occupied;
      expect(total, `${ward.unit.id}: drawn squares do not sum to its ${ward.unit.beds} beds`).toBe(ward.unit.beds);
    }
  });

  it("hatches exactly the beds still being made ready, and never more than the ready count", () => {
    const expected = bedMapWards(units, bedReleases);
    const preparingWards = expected.filter((ward) => ward.pendingPreparation > 0);
    expect(preparingWards.length, "no ward has a bed pending preparation — this guard proves nothing").toBeGreaterThan(
      0,
    );
    render(<BedMap units={units} bedReleases={bedReleases} />);
    for (const ward of expected) {
      const block = screen.getByTestId(`ward-bed-map-ward-${ward.unit.id}`);
      const hatched = block.querySelectorAll('[data-bed-map-preparing="true"]');
      expect(hatched.length, ward.unit.id).toBe(ward.pendingPreparation);
      expect(hatched.length, `${ward.unit.id}: more hatched squares than ready ones`).toBeLessThanOrEqual(ward.ready);
      // Every hatched square is drawn as a READY square (same base state), never a state of its own.
      for (const square of Array.from(hatched)) {
        expect(square.getAttribute("data-bed-map-state"), ward.unit.id).toBe("ready");
      }
    }
  });

  /**
   * 🔴 STATIC PROOF that a prepared bed's fill equals a ready bed's, because jsdom applies no
   * CSS-module styles (the same limitation `ward-capacity-screen.dom.test.tsx`'s own
   * ".attentionWho" test records) — so the property is proved by reading the stylesheet rather than
   * a computed style. `.preparing` may add a `background-image` (the hatch); if it ever declares a
   * `background-color` or the `background` shorthand, a prepared bed's fill would stop being a
   * ready bed's fill by construction.
   */
  it("never lets the hatch declare its own fill — a prepared bed's fill is a ready bed's fill", () => {
    const css = readFileSync("src/components/ward-management/capacity/bed-map.module.css", "utf8");
    const rule = /\.preparing\s*\{([^}]*)\}/mu.exec(css);
    expect(rule, "no .preparing rule found — the assertion below would be vacuous").not.toBeNull();
    const body = (rule as RegExpExecArray)[1];
    expect(body, "the preparing hatch declares its own background-color").not.toMatch(/background-color\s*:/u);
    expect(body, "the preparing hatch uses the background shorthand, which would erase .ready's fill").not.toMatch(
      /(?<![-\w])background\s*:/u,
    );
  });

  /**
   * 🔴 CORRECTS THIS TASK'S OWN BUILD BRIEF, which stated "WACHS has no inpatient unit reporting to
   * this board." Checked against `ward-sites.ts`: WACHS carries five real units today. This test
   * proves the general rule instead, on a MINIMAL synthetic network built for the purpose — a
   * service with nothing in it gets a sentence, never a heading over an empty group (the same
   * discipline `WardGroupHeading` enforces by throwing, applied here without importing a
   * people-scoped component for a ward count).
   */
  it("states a service with no reporting unit in words, and never heads an empty group", () => {
    const withoutWachs = units.filter((unit) => {
      // WACHS units in today's fixture: Albany, Bunbury, Broome, Geraldton (Kununurra has no ward
      // since 26 Sept 2026, owner-approved ward facts).
      return !["alb-adult-open", "bun-adult-open", "brm-adult-secure", "ger-adult-open"].includes(
        unit.id,
      );
    });
    expect(withoutWachs.length, "removed too many units — this fixture would be vacuous").toBeLessThan(units.length);
    const groups = groupBedMapWardsByService(bedMapWards(withoutWachs, bedReleases));
    const wachsGroup = groups.find((group) => group.service === "WACHS");
    expect(wachsGroup?.wards.length, "the synthetic fixture still has a WACHS unit").toBe(0);

    render(<BedMap units={withoutWachs} bedReleases={bedReleases} />);
    expect(
      screen.queryByRole("heading", { name: /WACHS/u }),
      "an empty service must not be headed",
    ).not.toBeInTheDocument();
    expect(screen.getByText(/WACHS has no inpatient unit reporting to this board/iu)).toBeInTheDocument();
  });

  /**
   * The other half of the same property, against the REAL fixture: today WACHS is not empty, so the
   * map must render it as a normal heading and ward blocks, not the absence sentence. This is the
   * test that would go red the day the brief's claim about WACHS becomes true.
   */
  it("renders WACHS as a normal heading with real ward blocks in today's fixture", () => {
    render(<BedMap units={units} bedReleases={bedReleases} />);
    expect(screen.getByRole("heading", { name: /WACHS/u })).toBeInTheDocument();
    expect(screen.queryByText(/WACHS has no inpatient unit/iu)).not.toBeInTheDocument();
  });

  it("names every state in the legend, including the hatched one", () => {
    render(<BedMap units={units} bedReleases={bedReleases} />);
    const legend = screen.getByLabelText("Bed map legend");
    expect(within(legend).getByText(/^Ready$/u)).toBeInTheDocument();
    expect(within(legend).getByText(/still being made ready/iu)).toBeInTheDocument();
    expect(within(legend).getByText(/Held/u)).toBeInTheDocument();
    expect(within(legend).getByText(/Blocked/u)).toBeInTheDocument();
    expect(within(legend).getByText(/^Occupied$/u)).toBeInTheDocument();
  });

  it("gives every square an accessible name", () => {
    render(<BedMap units={units} bedReleases={bedReleases} />);
    const readyBeds = screen.getAllByRole("img", { name: "Ready bed" });
    const preparingBeds = screen.getAllByRole("img", { name: "Ready bed — still being made ready" });
    const heldBeds = screen.getAllByRole("img", { name: "Held bed — not offered" });
    const occupiedBeds = screen.getAllByRole("img", { name: "Occupied bed" });
    expect(readyBeds.length + preparingBeds.length).toBeGreaterThan(0);
    expect(heldBeds.length).toBeGreaterThan(0);
    expect(occupiedBeds.length).toBeGreaterThan(0);
  });

  /**
   * ⚠️ ZERO READS "none", NEVER "0" — the same rule this whole screen already applies to Ready and
   * Locked (`ward-capacity-zero-spelling.dom.test.tsx`, census §8). Floored on a real ward actually
   * having a zero ready count so the word branch is exercised against real data.
   */
  it("states a ward's zero ready count as 'none', never a bare '0'", () => {
    const expected = bedMapWards(units, bedReleases);
    const zeroReadyWards = expected.filter((ward) => ward.ready === 0);
    expect(zeroReadyWards.length, "no ward has a zero ready count — this guard proves nothing").toBeGreaterThan(0);
    render(<BedMap units={units} bedReleases={bedReleases} />);
    for (const ward of zeroReadyWards) {
      const block = screen.getByTestId(`ward-bed-map-ward-${ward.unit.id}`);
      expect(block, ward.unit.id).toHaveTextContent(/none ready/iu);
      expect(block.textContent ?? "", `${ward.unit.id} kept a bare 0 beside "ready"`).not.toMatch(/\b0 ready/u);
    }
  });

  it("is rendered on the Capacity screen beneath the network table", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityScreen />
      </WardFlowProvider>,
    );
    const panel = screen.getByRole("region", { name: "Bed map" });
    expect(panel).toBeInTheDocument();
    expect(within(panel).getByLabelText("Bed map legend")).toBeInTheDocument();
  });

  it("calls onSelectWard when clicking a bed square", () => {
    const onSelectWard = vi.fn();
    render(<BedMap units={units} bedReleases={bedReleases} onSelectWard={onSelectWard} />);
    const firstWard = units[0];
    const block = screen.getByTestId(`ward-bed-map-ward-${firstWard.id}`);
    const firstSquare = block.querySelector(`[data-testid="ward-bed-map-square-${firstWard.id}"]`);
    expect(firstSquare, "bed square exists").not.toBeNull();
    fireEvent.click(firstSquare!);
    expect(onSelectWard).toHaveBeenCalledWith(firstWard.id);
  });

  it("calls onSelectWard when clicking the ward card body", () => {
    const onSelectWard = vi.fn();
    render(<BedMap units={units} bedReleases={bedReleases} onSelectWard={onSelectWard} />);
    const firstWard = units[0];
    const block = screen.getByTestId(`ward-bed-map-ward-${firstWard.id}`);
    fireEvent.click(block);
    expect(onSelectWard).toHaveBeenCalledWith(firstWard.id);
  });
});
