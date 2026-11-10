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
 * with a Collected button, and a discharge due today that waits on transport offers "Left the ward".
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

  it("offers Left the ward only on a due discharge still waiting on transport", () => {
    const state = seedWardFlowState();
    const units = new Set(
      state.admissions
        .filter((admission) => transportPendingFor(admission, state.bedReleases))
        .map((admission) => admission.unitId),
    );
    let offered = 0;
    for (const unitId of units) {
      const view = renderBoard(unitId);
      offered += screen.queryAllByRole("button", { name: "Left the ward" }).length;
      view.unmount();
    }
    expect(offered, "a seeded discharge due today waits on transport").toBeGreaterThan(0);
  });

  it("Left the ward asks where they are going, then lists them as waiting for transport", () => {
    const state = seedWardFlowState();
    const unitId = [
      ...new Set(
        state.admissions
          .filter((admission) => transportPendingFor(admission, state.bedReleases))
          .map((admission) => admission.unitId),
      ),
    ].find((candidate) => {
      const view = renderBoard(candidate);
      const found = screen.queryAllByRole("button", { name: "Left the ward" }).length > 0;
      view.unmount();
      return found;
    })!;
    renderBoard(unitId);
    const before = screen.queryAllByRole("button", { name: /^Collected/ }).length;
    fireEvent.click(screen.getAllByRole("button", { name: "Left the ward" })[0]!);
    const dialog = screen.getByRole("dialog", { name: "Confirm left the ward" });
    const proceed = within(dialog).getByTestId("ward-board-confirm-proceed") as HTMLButtonElement;
    expect(proceed.disabled, "no destination is chosen for the ward").toBe(true);
    fireEvent.change(within(dialog).getByTestId("ward-board-confirm-destination"), {
      target: { value: "discharged-to-the-community" },
    });
    fireEvent.click(proceed);
    expect(screen.getAllByRole("button", { name: /^Collected/ })).toHaveLength(before + 1);
  });
});
