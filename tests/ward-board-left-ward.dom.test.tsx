import { fireEvent, render, screen, within } from "@testing-library/react";
import { ToastProvider } from "@/components/wf";
import { describe, expect, it } from "vitest";

import { WardBoard } from "../src/components/ward-management/board/ward-board";
import { WardFlowProvider } from "../src/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { WARD_ADMISSIONS_ANCHOR } from "../src/components/ward-management/ward-admissions-seed";
import { transportPendingFor, waitingForTransport } from "../src/components/ward-management/ward-left-ward";

/*
 * Item 18 on the ward board: the seeded person who left the ward waiting for transport is listed
 * with a Collected button, and "They have left" on a discharge still waiting on transport asks whether they are waiting for it.
 */
const NOW = WARD_ADMISSIONS_ANCHOR + 40;

function renderBoard(unitId: string) {
  return render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW}>
        <WardBoard unitId={unitId} requireConfirmation={false} />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

describe("ward board: Left the ward, waiting for transport (item 18)", () => {
  it("lists the seeded person waiting for transport, and Collected takes them off", () => {
    const [entry] = waitingForTransport(seedWardFlowState().admissions);
    expect(entry).toBeDefined();
    renderBoard(entry!.unitId);
    const list = screen.getByTestId("ward-board-transport-wait");
    expect(within(list).getByRole("heading", { name: "Waiting for transport" })).toBeTruthy();
    const row = within(list).getByTestId(`ward-board-transport-wait-${entry!.admissionId}`);
    expect(row.textContent).toContain("Waiting since");
    fireEvent.click(within(row).getByRole("button", { name: /^Collected/ }));
    expect(screen.queryByTestId("ward-board-transport-wait")).toBeNull();
  });

  it("They have left asks about transport only on a due discharge still waiting on it", () => {
    const state = seedWardFlowState();
    const units = [
      ...new Set(
        state.admissions
          .filter((admission) => transportPendingFor(admission, state.bedReleases))
          .map((admission) => admission.unitId),
      ),
    ];
    let asked = 0;
    for (const unitId of units) {
      const view = renderBoard(unitId);
      // The row keeps its two actions: no separate "Left the ward" button.
      expect(screen.queryAllByRole("button", { name: "Left the ward" })).toHaveLength(0);
      if (openTransportDialog()) asked += 1;
      view.unmount();
    }
    expect(asked, "a seeded discharge due today waits on transport").toBeGreaterThan(0);
  });

  it("asks where they are going and whether transport came, then lists them as waiting", () => {
    const state = seedWardFlowState();
    const unitId = [
      ...new Set(
        state.admissions
          .filter((admission) => transportPendingFor(admission, state.bedReleases))
          .map((admission) => admission.unitId),
      ),
    ].find((candidate) => {
      const view = renderBoard(candidate);
      const found = openTransportDialog();
      view.unmount();
      return found;
    })!;
    renderBoard(unitId);
    const before = screen.queryAllByRole("button", { name: /^Collected/ }).length;
    expect(openTransportDialog()).toBe(true);
    const dialog = screen.getByRole("dialog", { name: "Confirm left the ward" });
    const proceed = within(dialog).getByTestId("ward-board-confirm-proceed") as HTMLButtonElement;
    expect(proceed.disabled, "no destination is chosen for the ward").toBe(true);
    fireEvent.change(within(dialog).getByTestId("ward-board-confirm-destination"), {
      target: { value: "discharged-to-the-community" },
    });
    expect(proceed.disabled, "transport is never defaulted").toBe(true);
    const transport = within(dialog).getByTestId("ward-board-confirm-transport");
    expect(
      within(transport)
        .getAllByRole("radio")
        .filter((radio) => (radio as HTMLInputElement).checked),
    ).toHaveLength(0);
    fireEvent.click(within(transport).getByRole("radio", { name: "No, still waiting for transport" }));
    fireEvent.click(proceed);
    expect(screen.getAllByRole("button", { name: /^Collected/ })).toHaveLength(before + 1);
  });

  it("the bed drawer's Record that they have left asks about transport too (Codex, #1608)", () => {
    const state = seedWardFlowState();
    const units = [
      ...new Set(
        state.admissions
          .filter((admission) => transportPendingFor(admission, state.bedReleases))
          .map((admission) => admission.unitId),
      ),
    ];
    let asked = 0;
    for (const unitId of units) {
      const view = renderBoard(unitId);
      const tiles = within(screen.getByTestId("ward-board-beds"))
        .getAllByRole("listitem")
        .filter((tile) => tile.getAttribute("data-bed-kind") === "occupied");
      for (const tile of tiles) {
        if (!tile.isConnected) continue;
        fireEvent.click(within(tile).getByRole("button"));
        const submit = screen.queryByTestId("ward-board-record-leaving-submit");
        if (!submit) continue;
        fireEvent.change(screen.getByTestId("ward-board-leaving-destination"), {
          target: { value: "discharged-to-the-community" },
        });
        // Board without confirmation: only a pending transport stops it recording at once.
        fireEvent.click(screen.getByTestId("ward-board-record-leaving-submit"));
        if (screen.queryByTestId("ward-board-confirm-transport")) {
          asked += 1;
          fireEvent.click(screen.getByTestId("ward-board-confirm-cancel"));
          break;
        }
      }
      view.unmount();
    }
    expect(asked, "a seeded discharge waiting on transport asks from the drawer").toBeGreaterThan(0);
  });
});

/** Presses each "They have left" until one opens the transport question; true when one did. */
function openTransportDialog(): boolean {
  const buttons = screen.queryAllByRole("button", { name: "They have left" });
  for (const button of buttons) {
    if (!button.isConnected) continue;
    fireEvent.click(button);
    if (screen.queryByTestId("ward-board-confirm-transport")) return true;
    const cancel = screen.queryByTestId("ward-board-confirm-cancel");
    if (cancel) fireEvent.click(cancel);
  }
  return false;
}
