import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as `ward-network-referral-placement.dom.test.tsx`: the network workspace renders a
// next/link anchor and this suite never checks routing.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";
import { initialNetworkPatientId } from "@/components/ward-management/ward-management-network";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Ward audit 2026-09-16, fix 5 (ward-management-network.tsx): `WardNetworkPlacementWorkspace`
 * defaulted its selection to `movements[0].id` — the first movement in the WHOLE seeded fixture,
 * unfiltered — while the queue right beneath it shows only `isOpen` movements. On an empty
 * `movements` array `movements[0]` is `undefined` and `.id` threw during the very first render,
 * before the component's own "no movement matches" guard ever ran. Fixed by defaulting to the
 * first OPEN movement, or `null`, via the exported `initialNetworkPatientId`.
 *
 * Neither corrected branch is reachable through the full component against the real seed — its
 * own first movement (`WF-001`) is already open, and there is no way to inject a movements array
 * into `WardFlowProvider` before the component's first render. `initialNetworkPatientId` is
 * exported for exactly this reason, the same pattern `isOfficerJob` (officer-screen.tsx) and
 * `DischargeGroupSection` (discharge-board.tsx) already use for their own unreachable branches.
 */
describe("initialNetworkPatientId — the network placement workspace's default selection", () => {
  it("returns null on an empty movements array instead of throwing", () => {
    expect(() => initialNetworkPatientId([])).not.toThrow();
    expect(initialNetworkPatientId([])).toBeNull();
  });

  it("skips a closed-or-arrived movement at index 0 for the first genuinely OPEN one", () => {
    const seeded = seedWardFlowState().movements;
    const openMovement = seeded.find((movement) => !movement.closure && movement.stage !== "arrived");
    const closedMovement = seeded.find((movement) => movement.closure !== undefined || movement.stage === "arrived");
    expect(openMovement, "the seed must carry an open movement, or this proves nothing").toBeDefined();
    expect(closedMovement, "the seed must carry a closed/arrived movement, or this proves nothing").toBeDefined();

    // Before this fix, `movements[0].id` would have returned the CLOSED movement's id here.
    const arranged: Movement[] = [closedMovement as Movement, openMovement as Movement];
    expect(initialNetworkPatientId(arranged)).toBe((openMovement as Movement).id);
  });

  it("returns null when every movement is closed or arrived", () => {
    const seeded = seedWardFlowState().movements;
    const closedMovements = seeded.filter((movement) => movement.closure !== undefined || movement.stage === "arrived");
    expect(closedMovements.length, "the seed must carry at least one closed/arrived movement").toBeGreaterThan(0);
    expect(initialNetworkPatientId(closedMovements)).toBeNull();
  });

  it("returns the first movement's own id when it is genuinely open (the common, unchanged case)", () => {
    const seeded = seedWardFlowState().movements;
    const openMovement = seeded.find((movement) => !movement.closure && movement.stage !== "arrived") as Movement;
    expect(initialNetworkPatientId([openMovement])).toBe(openMovement.id);
  });
});

describe("the network placement workspace opens on a movement its own queue actually shows", () => {
  it("selects a patient whose row is genuinely in the visible open queue, end to end", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardModeWorkspace mode="network" />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Placement workspace" }));

    // Renders the real workspace, not the "no synthetic movement matches" fallback — proving the
    // default selection resolved to a real, open movement rather than crashing or missing.
    expect(screen.getByTestId("ward-network-view")).toBeInTheDocument();
    expect(screen.queryByText(/No synthetic movement matches/)).not.toBeInTheDocument();

    // The one row the queue shows as selected (aria-pressed) must be an ACTUAL row of the visible
    // queue — i.e. a `ward-network-queue-<id>` element exists for it — never a movement the queue
    // itself excludes.
    const selectedRow = document.querySelector('[data-testid^="ward-network-queue-"][aria-pressed="true"]');
    expect(selectedRow, "no queue row is marked selected at all").not.toBeNull();
  });
});

/**
 * 2026-10-07 (v6): the Network overview's State Bedflow routes the movement a coordinator CHOOSES
 * in the Placement workspace's waiting list (the routed diagram Home used to carry). The
 * workspace's own default selection must not route anything: with nothing chosen the overview is
 * drawn with no subject, exactly as before. Choosing a referral clears the routed subject again.
 */
describe("the network overview routes only a movement the coordinator chose", () => {
  function overviewRoutedCount() {
    const overview = document.getElementById("ward-network-overview-panel");
    expect(overview, "the overview panel must be mounted").not.toBeNull();
    return (overview as HTMLElement).querySelectorAll('[data-routed="true"]').length;
  }

  it("draws no subject until a waiting-list row is chosen, then routes it, and a referral clears it", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardModeWorkspace mode="network" />
      </WardFlowProvider>,
    );
    expect(overviewRoutedCount()).toBe(0);

    // Opening the workspace shows its default selection, which is not a coordinator's choice.
    fireEvent.click(screen.getByRole("tab", { name: "Placement workspace" }));
    expect(document.querySelector('[data-testid^="ward-network-queue-"][aria-pressed="true"]')).not.toBeNull();
    expect(overviewRoutedCount()).toBe(0);

    fireEvent.click(screen.getByTestId("ward-network-queue-WF-009"));
    expect(overviewRoutedCount()).toBeGreaterThan(0);

    const referralRow = document.querySelector<HTMLButtonElement>('button[data-testid^="ward-network-referral-"]');
    expect(referralRow, "the seed must carry a referral row, or this proves nothing").not.toBeNull();
    fireEvent.click(referralRow as HTMLButtonElement);
    expect(overviewRoutedCount()).toBe(0);
  });
});
